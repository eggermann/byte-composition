import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import { initDB, getDB, BUFFER_DIR, getPublicPath, cleanupBuffer } from '../../lib/db';

// Initialize database when module loads
let dbInitPromise = initDB();

async function getRandomSample() {
  // Check for API key
  if (!process.env.FREESOUND_API_KEY) {
    throw new Error(
      'Freesound API key not found. Please set FREESOUND_API_KEY in your .env file'
    );
  }

  
  const rnd = Math.round(Math.random() * 100000);
  console.log('Random number:', rnd);


  try {
    const response = await fetch(
      `https://freesound.org/apiv2/search/text/?` +
      `query=${rnd}&` +
      `page_size=1&` +
      `fields=url,id,previews&` +
      `token=${process.env.FREESOUND_API_KEY}`, {
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid Freesound API key. Please check your .env configuration.');
      }
      throw new Error(`Freesound API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Freesound API response:', data);

    if (!data.results || data.results.length === 0) {
      console.log('No samples found, retrying with different tag...');
      return getRandomSample(); // Retry with different tag
    }

    return data.results[0];
  } catch (error) {
    console.error('Freesound API error:', error.message);
    throw error;
  }
}

async function downloadSample(preview, id) {
  console.log(`Downloading sample ${id}...`);
  
  const response = await fetch(preview);
  if (!response.ok) {
    throw new Error(`Failed to download sample: ${response.status} ${response.statusText}`);
  }

  // Get the sample size
  const arrayBuffer = await response.arrayBuffer();
  const sampleSize = arrayBuffer.byteLength;
  
  // Clean up buffer if needed
  await cleanupBuffer(sampleSize);
  
  const filePath = path.join(BUFFER_DIR, `${id}.mp3`);
  console.log(`Writing ${sampleSize} bytes to ${filePath}...`);
  
  // Save the file
  await fs.writeFile(filePath, Buffer.from(arrayBuffer));
  
  // Save to database
  const db = getDB();
  const metadata = {
    id,
    path: filePath,
    size: sampleSize,
    downloaded: new Date().toISOString()
  };
  
  db.put(id, metadata);
  console.log(`Saved metadata to database:`, metadata);
  
  return filePath;
}

async function getRandomBufferSample() {
  console.log(`Reading buffer directory: ${BUFFER_DIR}`);
  const files = await fs.readdir(BUFFER_DIR);
  
  if (files.length === 0) {
    throw new Error(`No samples available in buffer. Use the Freesound API to download some samples first. 
    Make sure your FREESOUND_API_KEY is set in .env`);
  }
  
  const randomFile = files[Math.floor(Math.random() * files.length)];
  const id = path.basename(randomFile, '.mp3');
  
  console.log(`Selected random file: ${randomFile}`);
  
  const db = getDB();
  const sampleInfo = db.get(id);
  
  if (!sampleInfo) {
    console.error(`Database entry not found for sample ${id}`);
    throw new Error('Sample metadata not found in database');
  }
  
  return {
    path: getPublicPath(sampleInfo.path),
    id: sampleInfo.id,
    size: sampleInfo.size
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Random API called');
    
    // Wait for database to be ready
    await dbInitPromise;

    try {
      // Try to fetch a new random sample
      const sample = await getRandomSample();
      const preview = sample.previews['preview-hq-mp3'];
      
      // Try to download and save the sample
      const filePath = await downloadSample(preview, sample.id);
      return res.status(200).json({
        id: sample.id,
        path: getPublicPath(filePath),
        source: 'freesound'
      });
    } catch (freesoundError) {
      console.error('Freesound API or download error:', freesoundError);
      
      // If Freesound fails, try to get a random sample from buffer
      try {
        const bufferSample = await getRandomBufferSample();
        return res.status(200).json({
          ...bufferSample,
          source: 'buffer',
          fallbackReason: 'Freesound API failed'
        });
      } catch (bufferError) {
        // If both fail, return a helpful error
        console.error('Buffer fallback error:', bufferError);
        return res.status(500).json({ 
          error: 'Could not get a sample',
          details: `1. Freesound API: ${freesoundError.message}
                   2. Buffer: ${bufferError.message}`,
          solution: 'Please set a valid FREESOUND_API_KEY in your .env file'
        });
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      details: error.message
    });
  }
}

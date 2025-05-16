import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import { initDB, getDB, BUFFER_DIR, getPublicPath, cleanupBuffer } from '../../lib/db';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '../.env.production') });

// Initialize database when module loads
let dbInitPromise = initDB();

async function getRandomSample() {
  const apiKey = process.env.FREESOUND_API_KEY?.trim();
  console.log('API Key Check:', {
    FREESOUND_API_KEY: process.env.FREESOUND_API_KEY,
    exists: !!apiKey,
    length: apiKey?.length,
    isPlaceholder: apiKey === 'FREESOUND_API_KEY'
  });

  if (!apiKey || apiKey === 'FREESOUND_API_KEY') {
    throw new Error(
      'Valid Freesound API key not found. Please set FREESOUND_API_KEY in your .env.production file with an actual API key'
    );
  }


  const rnd = Math.round(Math.random() * 100000);
  console.log('Random number:', rnd);


  try {
    const response = await fetch(
      `https://freesound.org/apiv2/search/text/?` +
      `query=${rnd}&` +
      `page_size=1&` +
      `fields=url,id,previews,description&` +
      `token=${apiKey}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Token ${apiKey}`
      }
    });

    console.log('Freesound API request:', {
      url: response.url,
      status: response.status,
      statusText: response.statusText
    });

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

    const sample = data.results[0];
    return {
      ...sample,
      description: sample.description || 'No description available'
    };
  } catch (error) {
    console.error('Freesound API error:', error.message);

    // Try to get a random sample from buffer instead
    console.log('Attempting to fall back to buffer sample...');
    const bufferSample = await getRandomBufferSample();
    return {
      id: bufferSample.id,
      previews: {
        'preview-hq-mp3': bufferSample.path
      },
      description: bufferSample.description
    };
  }
}

async function downloadSample(preview, id, description) {
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
    downloaded: new Date().toISOString(),
    description: description || 'No description available'
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
    size: sampleInfo.size,
    description: sampleInfo.description || 'No description available'
  };
}

export default async function handler(req, res) {
  // Enable CORS
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  console.log('API Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    currentUrl: req.url
  });

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Random API called');

    // Wait for database to be ready
    await dbInitPromise;

    // Get a random sample (will fallback to buffer if needed)
    const sample = await getRandomSample();
    const preview = sample.previews['preview-hq-mp3'];

    // If the sample is from buffer, return it directly
    if (preview.startsWith('/samples/')) {
      return res.status(200).json({
        id: sample.id,
        path: preview,
        description: sample.description,
        source: 'buffer',
        fallbackReason: 'Used buffer sample'
      });
    }

    // Try to download and save the Freesound sample
    try {
      const filePath = await downloadSample(preview, sample.id, sample.description);
      return res.status(200).json({
        id: sample.id,
        path: getPublicPath(filePath),
        description: sample.description,
        source: 'freesound'
      });
    } catch (downloadError) {
      console.error('Download error:', downloadError);
      // If download fails, get a random buffer sample as fallback
      const bufferSample = await getRandomBufferSample();
      return res.status(200).json({
        ...bufferSample,
        source: 'buffer',
        fallbackReason: 'Download failed'
      });
    }
  } catch (error) {
    console.error('Unexpected error:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      env: process.env.NODE_ENV,
      dbPath: getDB().path
    });

    return res.status(500).json({
      error: 'Server error',
      details: error.message,
      path: req.url,
      env: process.env.NODE_ENV
    });
  }
}

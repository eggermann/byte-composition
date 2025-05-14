import { initDB, getDB, getPublicPath, BUFFER_DIR } from '../../lib/db';
import fs from 'fs-extra';
import path from 'path';

// Initialize database when module loads
let dbInitPromise = initDB();

// Get total size of buffer directory
async function getBufferStats() {
  let totalSize = 0;
  const files = await fs.readdir(BUFFER_DIR);
  
  for (const file of files) {
    const stats = await fs.stat(path.join(BUFFER_DIR, file));
    totalSize += stats.size;
  }
  
  return {
    totalSize,
    sampleCount: files.length,
    maxSize: 400 * 1024 * 1024, // 400MB in bytes
    usagePercent: (totalSize / (400 * 1024 * 1024) * 100).toFixed(1)
  };
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:9001');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      allowedMethods: ['GET']
    });
  }

  try {
    console.log('Samples API called');
    
    // Wait for database to be ready
    const db = await dbInitPromise;

    // Get all samples from the database
    const samples = [];
    db.keys().forEach(key => {
      try {
        const sample = db.get(key);
        samples.push({
          id: sample.id,
          path: getPublicPath(sample.path),
          size: sample.size,
          downloaded: sample.downloaded,
          description: sample.description || 'No description available'
        });
      } catch (sampleError) {
        console.error(`Error processing sample ${key}:`, sampleError);
      }
    });

    // Get buffer statistics
    const stats = await getBufferStats();
    console.log('Buffer stats:', stats);

    // Sort samples by download date (newest first)
    samples.sort((a, b) => new Date(b.downloaded) - new Date(a.downloaded));

    return res.status(200).json({
      count: samples.length,
      bufferStats: stats,
      results: samples
    });
  } catch (error) {
    console.error('Error fetching samples:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch samples from database',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Mark as API route
export const config = {
  api: {
    bodyParser: true,
  },
};
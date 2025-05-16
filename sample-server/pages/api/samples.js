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
  console.log('Samples API called:', {
    url: req.url,
    method: req.method,
    env: process.env.NODE_ENV
  });

  // Enable CORS
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigin = isProd ? process.env.FRONTEND_BASE_URL : 'http://localhost:9001';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      allowedMethods: ['GET'],
      method: req.method
    });
  }

  try {
    
    // Wait for database to be ready
    let db;
    try {
      db = await dbInitPromise;
      console.log('Database initialized:', {
        path: db.path,
        env: process.env.NODE_ENV
      });
    } catch (dbError) {
      console.error('Database initialization error:', dbError);
      throw new Error(`Database initialization failed: ${dbError.message}`);
    }

    // Get all samples from the database
    const samples = [];
    db.keys().forEach(key => {
      console.log('Processing sample:', key);
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
    let stats;
    try {
      stats = await getBufferStats();
      console.log('Buffer stats:', {
        ...stats,
        env: process.env.NODE_ENV,
        bufferDir: BUFFER_DIR
      });
    } catch (statsError) {
      console.error('Error getting buffer stats:', statsError);
      stats = {
        totalSize: 0,
        sampleCount: samples.length,
        maxSize: 400 * 1024 * 1024,
        usagePercent: '0.0',
        error: statsError.message
      };
    }

    // Sort samples by download date (newest first)
    samples.sort((a, b) => new Date(b.downloaded) - new Date(a.downloaded));

    const response = {
      count: samples.length,
      bufferStats: stats,
      results: samples,
      env: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    };

    console.log('Sending response:', {
      sampleCount: response.count,
      bufferStats: response.bufferStats
    });

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching samples:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      env: process.env.NODE_ENV,
      dbPath: getDB().path
    });
    
    return res.status(500).json({
      error: 'Failed to fetch samples from database',
      details: error.message,
      path: req.url,
      env: process.env.NODE_ENV,
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
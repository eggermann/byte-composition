import { initDB, getDB, getPublicPath } from '../../lib/db';

// Initialize database when module loads
let dbInitPromise = initDB();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      allowedMethods: ['GET']
    });
  }

  try {
    console.log('Samples API called');
    
    // Wait for database to be ready
    await dbInitPromise;
    const db = getDB();

    // Get all samples from the database
    const samples = [];
    db.keys().forEach(key => {
      try {
        const sample = db.get(key);
        samples.push({
          id: sample.id,
          path: getPublicPath(sample.path), // Convert to public URL
          downloaded: sample.downloaded
        });
      } catch (sampleError) {
        console.error(`Error processing sample ${key}:`, sampleError);
      }
    });

    // Log the result for debugging
    console.log(`Found ${samples.length} samples`);

    return res.status(200).json({
      count: samples.length,
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
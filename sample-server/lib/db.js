import path from 'path';
import flatfile from 'flat-file-db';
import fs from 'fs-extra';

// Set up paths
const DB_PATH = path.join(process.cwd(), 'samples.db');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const BUFFER_DIR = path.join(PUBLIC_DIR, 'buffer');

// Buffer size limit (400MB in bytes)
const BUFFER_SIZE_LIMIT = 400 * 1024 * 1024;

let db = null;
let isReady = false;

// Get total size of buffer directory
async function getBufferSize() {
  let totalSize = 0;
  const files = await fs.readdir(BUFFER_DIR);
  
  for (const file of files) {
    const stats = await fs.stat(path.join(BUFFER_DIR, file));
    totalSize += stats.size;
  }
  
  return totalSize;
}

// Delete oldest samples until buffer is under limit
async function cleanupBuffer(requiredSpace = 0) {
  const currentSize = await getBufferSize();
  if (currentSize + requiredSpace <= BUFFER_SIZE_LIMIT) {
    return; // No cleanup needed
  }

  console.log(`Buffer cleanup needed. Current size: ${currentSize} bytes`);
  
  // Get all samples sorted by download date
  const samples = db.keys()
    .map(key => ({ id: key, ...db.get(key) }))
    .sort((a, b) => new Date(a.downloaded) - new Date(b.downloaded));

  for (const sample of samples) {
    // Delete file and database entry
    try {
      await fs.remove(sample.path);
      db.del(sample.id);
      console.log(`Deleted old sample: ${sample.id}`);
      
      // Check if we've cleared enough space
      const newSize = await getBufferSize();
      if (newSize + requiredSpace <= BUFFER_SIZE_LIMIT) {
        console.log(`Buffer cleaned up. New size: ${newSize} bytes`);
        return;
      }
    } catch (error) {
      console.error(`Error deleting sample ${sample.id}:`, error);
    }
  }
}

export function initDB() {
  if (db) return Promise.resolve(db);

  return new Promise((resolve, reject) => {
    // Ensure directories exist
    fs.ensureDirSync(PUBLIC_DIR);
    fs.ensureDirSync(BUFFER_DIR);
    console.log('Buffer directory created at:', BUFFER_DIR);

    db = flatfile(DB_PATH);

    db.on('open', () => {
      console.log('Database loaded and ready');
      isReady = true;
      
      // Log current database contents
      const keys = db.keys();
      console.log(`Database contains ${keys.length} samples:`, keys);
      
      // Log current buffer size
      getBufferSize().then(size => {
        console.log(`Current buffer size: ${size} bytes (Limit: ${BUFFER_SIZE_LIMIT} bytes)`);
      });
      
      resolve(db);
    });

    db.on('error', (err) => {
      console.error('Database error:', err);
      reject(err);
    });
  });
}

// Convert internal file path to public URL
export function getPublicPath(filePath) {
  const relativePath = path.relative(PUBLIC_DIR, filePath);
  return '/' + relativePath.replace(/\\/g, '/');
}

export function getDB() {
  if (!isReady) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return db;
}

export { BUFFER_DIR, cleanupBuffer };
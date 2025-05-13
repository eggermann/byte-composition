import path from 'path';
import flatfile from 'flat-file-db';
import fs from 'fs-extra';

// Set up paths
const DB_PATH = path.join(process.cwd(), 'samples.db');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const BUFFER_DIR = path.join(PUBLIC_DIR, 'buffer');

let db = null;
let isReady = false;

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

export { BUFFER_DIR };
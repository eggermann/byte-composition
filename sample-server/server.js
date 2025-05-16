
const path = require('path');
const fs = require('fs');
const express = require('express');
require('next');
const { startServer } = require('next/dist/server/lib/start-server');

// Set essential environment variables
process.env.NODE_ENV = 'production';

// Load environment variables
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env.production') });
} catch (error) {
  console.warn('Failed to load .env.production:', error.message);
}

// Set up public directories
const publicDir = path.join(__dirname, 'public');
const bufferDir = path.join(publicDir, 'buffer');

// Create directories if they don't exist
[publicDir, bufferDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Make sure commands gracefully respect termination signals (e.g. from Docker)
// Allow the graceful termination to be manually configurable
if (!process.env.NEXT_MANUAL_SIG_HANDLE) {
  process.on('SIGTERM', () => process.exit(0))
  process.on('SIGINT', () => process.exit(0))
}

const currentPort = parseInt(process.env.PORT, 10) || 3000
const hostname = process.env.HOSTNAME || '0.0.0.0'

let keepAliveTimeout = parseInt(process.env.KEEP_ALIVE_TIMEOUT, 10)
const nextConfigPath = path.resolve(__dirname, './next.config.js');
console.log('Next.js config path:', process.env.PORT);


// Default Next.js configuration
let nextConfig = {
  distDir: '.next',
  serverRuntimeConfig: {},
  publicRuntimeConfig: {},
  amp: { canonicalBase: '' },
  assetPrefix: '',
  basePath: '',
  reactStrictMode: false,
  useFileSystemPublicRoutes: true,
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  env: {
    FREESOUND_API_KEY: process.env.FREESOUND_API_KEY,
    IS_PRODUCTION: process.env.NODE_ENV === 'production' ? 'true' : 'false'
  },
  optimizeFonts: true,
  swcMinify: true,
  poweredByHeader: false,
  experimental: {
    optimizeCss: true
  },
  output: 'standalone',
  configOrigin: 'next.config.js',
  configFile: path.join(__dirname, 'next.config.js')
};

// Load user config if exists
try {
  if (fs.existsSync(nextConfigPath)) {
    const userConfig = require(nextConfigPath);
    nextConfig = { ...nextConfig, ...userConfig };
    console.log('Loaded next.config.js');
  }
} catch (error) {
  console.warn('Error loading next.config.js:', error.message);
}

try {
  if (fs.existsSync(nextConfigPath)) {
    const userConfig = require(nextConfigPath);
    nextConfig = { ...nextConfig, ...userConfig };
    console.log('Loaded next.config.js');
  } else {
    console.warn('next.config.js not found, using default configuration.');
  }
} catch (error) {
  console.warn('Error loading next.config.js:', error.message);
  console.warn('Using default configuration.');
}

// Ensure Next.js has all required paths
nextConfig.configFileName = 'next.config.js';
nextConfig.configOrigin = path.join(__dirname, 'next.config.js');
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig);


if (
  Number.isNaN(keepAliveTimeout) ||
  !Number.isFinite(keepAliveTimeout) ||
  keepAliveTimeout < 0
) {
  keepAliveTimeout = undefined
}

// Initialize Next.js configuration
const serverConfig = {
  dir: __dirname,
  dev: false,
  hostname,
  port: currentPort,
  allowRetry: false,
  keepAliveTimeout,
  conf: {
    ...nextConfig,
    distDir: '.next',
    serverRuntimeConfig: {
      ...nextConfig.serverRuntimeConfig,
      PUBLIC_DIR: publicDir,
      BUFFER_DIR: bufferDir
    },
    publicRuntimeConfig: {
      ...nextConfig.publicRuntimeConfig
    }
  }
};

// Initialize Next.js app
const dev = false;
const nextApp = require('next')({ dev, dir: __dirname });
const handle = nextApp.getRequestHandler();

nextApp.prepare()
  .then(() => {
    // Create express server for handling static files
    const server = express();

    // Serve buffer files with correct MIME type
    server.use('/buffer', express.static(bufferDir, {
      setHeaders: (res) => {
        res.set('Content-Type', 'audio/mpeg');
        res.set('Accept-Ranges', 'bytes');
        res.set('Access-Control-Allow-Origin', process.env.FRONTEND_BASE_URL || 'http://localhost:9001');
      }
    }));

    // Let Next.js handle everything else
    server.all('*', (req, res) => {
      return handle(req, res);
    });

    // Start the server
    server.listen(currentPort, hostname, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://${hostname}:${currentPort}`);
      console.log('> Serving audio files from:', bufferDir);
    });
  })
  .catch((err) => {
    console.error('Error starting server:', err);
    process.exit(1);
  });
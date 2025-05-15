
const path = require('path');
const fs = require('fs');
require('next');
const { startServer } = require('next/dist/server/lib/start-server');
require('dotenv').config({ path: path.join(__dirname,  '../.env.production') });

// Set essential environment variables
process.env.NODE_ENV = 'production'



// Use current directory for Next.js
const dir = __dirname


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
    optimizeCss: true,
    critters: {
      preload: 'media',
      preloadFonts: true
    },
    outputFileTracingRoot: __dirname
  },
  dir: __dirname,
  pagesDir: path.join(__dirname, 'pages'),
  output: 'standalone',
  configOrigin: 'next.config.js',
  configFile: path.join(__dirname, 'next.config.js'),
  future: {
    strictPostcssConfiguration: true
  }
};

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

// Check for required directories
const buildDir = path.join(__dirname, '.next');
const pagesDir = path.join(__dirname, 'pages');
const requiredPaths = [buildDir, pagesDir];

for (const p of requiredPaths) {
  if (!fs.existsSync(p)) {
    console.error(`Required path not found: ${p}`);
    console.error('Please ensure you have run "npm run build" first');
    process.exit(1);
  }
}

const serverConfig = {
  dir: __dirname,
  dev: false,
  hostname,
  port: currentPort,
  allowRetry: false,
  keepAliveTimeout,
  customServer: true,
  conf: {
    ...nextConfig,
    configFile: path.join(__dirname, 'next.config.js'),
    distDir: '.next',
    serverRuntimeConfig: {},
    publicRuntimeConfig: {},
    dirs: {
      pages: pagesDir,
      app: __dirname,
      root: __dirname
    }
  }
};

console.log('Starting server with config:', {
  port: serverConfig.port,
  hostname: serverConfig.hostname,
  dir: serverConfig.dir,
  pagesDir: serverConfig.conf.dirs.pages
});

startServer(serverConfig).catch((err) => {
  console.error('Server failed to start:', err);
  console.error('Error details:', err.message);
  process.exit(1);
});
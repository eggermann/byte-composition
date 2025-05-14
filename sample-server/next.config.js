/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const FRONTEND_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:9001';

module.exports = {
  // Disable React Strict Mode to prevent double mounting in development
  reactStrictMode: false,
  env: {
    FREESOUND_API_KEY: process.env.FREESOUND_API_KEY,
    IS_PRODUCTION: isProd
  },
  // Configure headers for audio files
  async headers() {
    return [
      {
        source: '/buffer/:path*',
        headers: [
          {
            key: 'Content-Type',
            value: 'audio/mpeg',
          },
          {
            key: 'Accept-Ranges',
            value: 'bytes',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: FRONTEND_URL,
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Accept',
          }
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: FRONTEND_URL,
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Accept',
          }
        ],
      }
    ]
  },

  // Output configuration for deployment
  output: isProd ? 'standalone' : undefined,

  // Enable experimental features for production optimization
  experimental: {
    optimizeCss: true,
    outputFileTracingRoot: undefined,
  }
}
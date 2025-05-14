/** @type {import('next').NextConfig} */
module.exports = {
  // Disable React Strict Mode to prevent double mounting in development
  reactStrictMode: false,
  env: {
    FREESOUND_API_KEY: process.env.FREESOUND_API_KEY,
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
            value: 'http://localhost:9001',
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
            value: 'http://localhost:9001',
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
  }
}
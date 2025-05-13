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
        ],
      },
    ]
  }
}
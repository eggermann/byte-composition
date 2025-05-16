/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production';


module.exports = {
  reactStrictMode: false,
  poweredByHeader: false,
  distDir: '.next',
  // Mount the app under /sample-server in production
  basePath: isProd ? '/sample-server' : '',
  assetPrefix: isProd ? '/sample-server' : '',

  // Serve public files
  async rewrites() {
    return [
      {
        source: '/buffer/:path*',
        destination: '/public/buffer/:path*',
      },
    ];
  },

  // Set CORS headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET' },
        ],
      },
    ];
  },
};
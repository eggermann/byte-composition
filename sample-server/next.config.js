const isProd = process.env.NODE_ENV === 'production';
const BASE_PATH = isProd ? '/sample-server' : '';
const allowedOrigin = '*';

module.exports = {
  reactStrictMode: false,
  poweredByHeader: false,
  distDir: '.next',
  basePath: BASE_PATH,
  assetPrefix: isProd ? 'https://eggman2.uber.space/sample-server' : '',

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `/api/:path*`
      }
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: allowedOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' }
        ]
      }
    ];
  }
};
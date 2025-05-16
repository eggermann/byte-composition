const isProd = process.env.NODE_ENV === 'production';
const BASE_PATH = isProd ? '/sample-server' : '';

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
        destination: `${BASE_PATH}/api/:path*`
      },
      {
        source: '/buffer/:path*',
        destination: '/public/buffer/:path*'
      }
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' }
        ]
      }
    ];
  }
};
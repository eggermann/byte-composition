const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  reactStrictMode: false,
  poweredByHeader: false,
  distDir: '.next',
  basePath: isProd ? '/sample-server' : '',
  assetPrefix: isProd ? '/sample-server' : '',

  async rewrites() {
    return [
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
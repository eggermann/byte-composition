const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  reactStrictMode: false,
  poweredByHeader: false,
  distDir: '.next',

  // Serve everything under /sample-server in production
  basePath: isProd ? '/sample-server' : '',
  assetPrefix: isProd ? '/sample-server/' : '',

  crossOrigin: 'anonymous',
  async rewrites() {
    return [{ source: '/api/:path*', destination: '/api/:path*' }];
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization' },
        ],
      },
    ];
  },
};
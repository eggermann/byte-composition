const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const webpack = require('webpack');
const dotenv = require('dotenv');

// Load environment variables based on NODE_ENV
const env = process.env.NODE_ENV || 'development';
const envFile = env === 'production' ? '.env.production' : '.env.development';
const envConfig = dotenv.config({ path: envFile }).parsed;

console.log(`Using ${envFile} configuration...`);

// Create a new object with stringified values
const envKeys = Object.keys(envConfig).reduce((prev, next) => {
  prev[`process.env.${next}`] = JSON.stringify(envConfig[next]);
  return prev;
}, {});

module.exports = {
  mode: env === 'production' ? 'production' : 'development',
  optimization: {
    moduleIds: 'deterministic',
    runtimeChunk: 'single',
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
  },
  output: {
    publicPath: '/',
    path: path.resolve(__dirname, 'dist'),
    filename: env === 'production' ? '[name].[contenthash].js' : '[name].js',
    globalObject: 'self',
    clean: true
  },
  resolve: {
    extensions: ['.js', '.jsx', '.worklet.js', '.scss'],
    fallback: {
      "os": false
    }
  },
  plugins: [
    new webpack.ids.HashedModuleIdsPlugin(),
    new webpack.ProgressPlugin({
      percentBy: 'entries'
    }),
    new HtmlWebpackPlugin({
      template: 'src/index.html',
      minify: env === 'production' ? {
        removeComments: true,
        collapseWhitespace: true,
        removeAttributeQuotes: true
      } : false
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(env),
      'window.ENV': JSON.stringify({
        FREESOUND_API_KEY: envConfig.FREESOUND_API_KEY,
        SAMPLE_SERVER_URL: envConfig.SAMPLE_SERVER_URL,
        FRONTEND_BASE_URL: envConfig.FRONTEND_BASE_URL
      })
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist')
    },
    port: 9001,
    hot: true,
    open: true
  },
  module: {
    rules: [{
      test: /\.jsx?$/, // More specific test for .js and .jsx files
      // exclude: /\.css$/, // Remove exclude, rely on specific test
      include: [path.resolve(__dirname, 'src'), path.resolve(__dirname, 'node_modules/tone')], // Keep include for src and tone
      loader: 'babel-loader'
    },
    {
      test: /\.(mp3|wav)$/,
      type: 'asset/resource'
    },
    {
      test: /\.worklet\.js$/,
      use: [
        {
          loader: 'worklet-loader',
          options: {
            inline: false
          }
        }
      ]
    },
    {
      test: /\.css$/,
      use: [
        {
          loader: 'style-loader',
          options: { injectType: 'styleTag' }
        },
        {
          loader: 'css-loader',
          options: { importLoaders: 1 }
        }
      ]
    },
    { // Add SCSS rule
      test: /\.scss$/,
      use: [
        'style-loader', // Injects styles into DOM
        'css-loader',   // Translates CSS into CommonJS
        'sass-loader'   // Compiles Sass to CSS
      ]
    }]
  },
}

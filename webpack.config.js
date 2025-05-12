const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const webpack = require('webpack');
const dotenv = require('dotenv');

// Load environment variables from .env file
const env = dotenv.config().parsed;

// Create a new object with stringified values
const envKeys = Object.keys(env).reduce((prev, next) => {
  prev[`process.env.${next}`] = JSON.stringify(env[next]);
  return prev;
}, {});

module.exports = {
  mode: 'development',
  output: {
    publicPath: '/',
    filename: '[name].js',
    globalObject: 'self'
  },
  resolve: {
    extensions: ['.js', '.jsx', '.worklet.js', '.scss'],
    fallback: {
      "os": false
    }
  },
  plugins: [
    new webpack.ProgressPlugin(),
    new HtmlWebpackPlugin({
      template: 'src/index.html'
    }),
    new webpack.DefinePlugin({
      'window.ENV': JSON.stringify({
        FREESOUND_API_KEY: env.FREESOUND_API_KEY
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
      test: /\.(js|jsx)$/,
      exclude: /\.css$/, // Exclude CSS files from Babel processing
      include: [path.resolve(__dirname, 'src'), path.resolve(__dirname, 'node_modules/tone')],
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

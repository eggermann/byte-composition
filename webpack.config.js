const HtmlWebpackPlugin = require('html-webpack-plugin');
const commitHash = require('child_process').execSync('git rev-parse --short HEAD').toString().trim();
const path = require('path');
const webpack = require('webpack');
const dotenv = require('dotenv');
const fs = require('fs');

// Custom plugin to write commit-hash.config.json after build
class WriteCommitConfigPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tap('WriteCommitConfigPlugin', (compilation) => {
      try {
        const commitHash = require('child_process').execSync('git rev-parse --short HEAD').toString().trim();
        const commitMessage = require('child_process').execSync('git log -1 --pretty=%B').toString().trim();
        const outDir = path.resolve(__dirname, 'deploy', commitHash);
        const configPath = path.join(outDir, `${commitHash}.config.json`);
        const config = {
          description: commitMessage,
          title: commitHash
        };
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        console.log(`Wrote ${configPath}`);
      } catch (err) {
        console.error('Failed to write commit config:', err);
      }
    });
  }
}

// Load environment variables based on NODE_ENV
const env = process.env.NODE_ENV || 'development';
const envFile = '.env.production';// env === 'production' ? '.env.production' : '.env.development';
const envConfig = dotenv.config({ path: envFile }).parsed || {};

console.log(`Using ${envFile} configuration...`);
console.log('Environment config loaded:', envConfig);

// Create a new object with stringified values
const envKeys = Object.keys(envConfig || {}).reduce((prev, next) => {
  prev[`process.env.${next}`] = JSON.stringify(envConfig[next]);
  return prev;
}, {});


module.exports = {
  stats: {
    children: true
  },
  devtool: env === 'production' ? 'source-map' : 'eval-source-map',
  entry: './frontend/js/index.js',
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
    // Dynamically set publicPath to match the commit hash folder
    publicPath:  env === 'production' ? `/deploy/${commitHash}/`:'',
    // Dynamically generate output folder based on Git commit hash
    path: path.resolve(__dirname, 'deploy', commitHash),
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
    //new webpack.ids.HashedModuleIdsPlugin(),
    new webpack.ProgressPlugin({
      percentBy: 'entries'
    }),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.resolve(__dirname, 'frontend/index.html'),
      inject: 'body',
      scriptLoading: 'defer',
      minify: env === 'production' ? {
        removeComments: true,
        collapseWhitespace: true,
        removeAttributeQuotes: true
      } : false
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(env),
      'window.ENV': JSON.stringify({
        FREESOUND_API_KEY: envConfig?.FREESOUND_API_KEY ,
        SAMPLE_SERVER_URL: envConfig?.SAMPLE_SERVER_URL || 'http://localhost:5673',
        FRONTEND_BASE_URL: envConfig?.FRONTEND_BASE_URL || 'http://localhost:9001'
      })
    }),
  new WriteCommitConfigPlugin(),
  ],
  devServer: {
    historyApiFallback: true,
    static: {
      directory: path.join(__dirname, 'dist'),
      publicPath: '/',
      serveIndex: true
    },
    watchFiles: {
      paths: ['frontend/**/*'],
      options: {
        usePolling: false,
      }
    },
    port: 9001,
    hot: true,
    open: true,
    compress: true,
    devMiddleware: {
      publicPath: '/',
      writeToDisk: false
    },
    client: {
      overlay: {
        errors: true,
        warnings: false
      }
    }
  },
  module: {
    rules: [{
      test: /\.jsx?$/, // More specific test for .js and .jsx files
      // exclude: /\.css$/, // Remove exclude, rely on specific test
      include: [path.resolve(__dirname, 'frontend'), path.resolve(__dirname, 'node_modules/tone')], // Keep include for frontend and tone
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

var path = require('path');
var webpack = require('webpack');
var ngAnnotatePlugin = require('ng-annotate-webpack-plugin');

var production = process.env.NODE_ENV == 'production';

module.exports = {
  entry: './app.js',
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'bundle.js',
  },
  plugins: [
    new ngAnnotatePlugin({add: true}),
  ].concat(production ? [
    new webpack.optimize.UglifyJsPlugin(),
    new webpack.optimize.OccurenceOrderPlugin(),
  ] : []),
  resolve: {
    extensions: [
      '',
      '.ts',
      '.js',
    ],
  },
  module: {
    loaders: [
      {
        test: /\.ts$/,
        loaders: ['babel-loader', 'ts-loader'],
      },
      {
        test: /\.js$/,
        loaders: ['babel-loader'],
      },
      {
        test: /\.less$/,
        loaders: ['style-loader', 'css-loader?minimize', 'less-loader'],
      },
    ],
  },
};

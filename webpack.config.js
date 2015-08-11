var webpack = require('webpack');
var ngAnnotatePlugin = require('ng-annotate-webpack-plugin');

module.exports = {
  entry: './ui/app.js',
  output: {
    path: __dirname + '/ui',
    filename: 'bundle.js'
  },
  plugins: [
    new ngAnnotatePlugin({add: true})
  ],
};

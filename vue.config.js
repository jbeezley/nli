const process = require('process'); // eslint-disable-line import/no-extraneous-dependencies
const vtkChainWebpack = require('vtk.js/Utilities/config/chainWebpack');

module.exports = {
  devServer: {
    overlay: {
      warnings: false,
      errors: false,
    },
  },
  chainWebpack: (config) => {
      // Add vtk.js rules
      vtkChainWebpack(config);

    // fix development with npm link
    config.resolve.symlinks(false);

    // Fix an issue with HMR and the worker-loader
    // https://github.com/webpack/webpack/issues/6642
    // https://github.com/vuejs/vue-cli/issues/2276
    if (process.env.NODE_ENV !== 'production') {
      config.output.globalObject('this');
    }
  },
  // https://github.com/webpack-contrib/worker-loader/issues/177
  parallel: false,
};

const singleSpaAngularWebpack = require('single-spa-angular/lib/webpack').default;

module.exports = (config, options) => {
  const singleSpaWebpackConfig = singleSpaAngularWebpack(config, options);

  // Keep zone.js in the bundle for standalone mode.
  // When the shell already has zone.js loaded, the import is a harmless no-op.
  if (Array.isArray(singleSpaWebpackConfig.externals)) {
    singleSpaWebpackConfig.externals = singleSpaWebpackConfig.externals.filter((ext) => {
      if (ext instanceof RegExp) return !ext.test('zone.js');
      if (typeof ext === 'string') return ext !== 'zone.js';
      return true;
    });
  }

  return singleSpaWebpackConfig;
};

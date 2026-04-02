const singleSpaAngularWebpack = require('single-spa-angular/lib/webpack').default;

module.exports = (config, options) => {
  const singleSpaWebpackConfig = singleSpaAngularWebpack(config, options);

  // single-spa-angular externalizes zone.js so the shell can provide it.
  // Remove zone.js from externals so it stays in the bundle for standalone mode.
  // (When the shell already has zone.js loaded, the import is harmless.)
  if (Array.isArray(singleSpaWebpackConfig.externals)) {
    singleSpaWebpackConfig.externals = singleSpaWebpackConfig.externals.filter(
      (ext) => {
        if (ext instanceof RegExp) return !ext.test('zone.js');
        if (typeof ext === 'string') return ext !== 'zone.js';
        return true;
      }
    );
  }

  return singleSpaWebpackConfig;
};

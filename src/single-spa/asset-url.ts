// This is used to load assets from the correct location when the app
// is loaded as a microfrontend via single-spa.
// In standalone mode, the assets are served from the root.
// In single-spa mode, the assets are served from the deployed URL.

export function assetUrl(url: string): string {
  // @ts-ignore
  const publicPath = __webpack_public_path__;
  const publicPathSuffix = publicPath.endsWith('/') ? '' : '/';
  const urlPrefix = url.startsWith('/') ? '' : '/';
  return `${publicPath}${publicPathSuffix}assets${urlPrefix}${url}`;
}

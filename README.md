# ShellAng20 — Angular 20 Microfrontend with single-spa

A guide for converting a standard Angular 20 (NgModule-based) application into a **single-spa microfrontend** that can:

- Run **standalone** via `ng serve` (normal Angular app)
- Be **mounted inside a shell** application via single-spa lifecycle hooks

---

## Why This Guide Exists

Angular 17+ defaults to the ESBuild-based `@angular/build:application` builder, which **does not support** the custom webpack config that single-spa requires. This guide walks through the necessary builder swap and all the wiring needed to make it work with Angular 20.

---

## Prerequisites

- Angular CLI 20.x project (NgModule-based, not standalone components)
- Node.js 18+
- A shell application that uses single-spa to orchestrate microfrontends

---

## Step-by-Step Conversion

### 1. Install Dependencies

```bash
npm install single-spa single-spa-angular @angular-builders/custom-webpack@20 @angular-devkit/build-angular@20
```

Key packages:
- `single-spa` — the microfrontend orchestrator
- `single-spa-angular` — Angular-specific lifecycle helpers + webpack config
- `@angular-builders/custom-webpack@20` — lets us customize webpack (Angular 20 compatible)
- `@angular-devkit/build-angular@20` — the `browser` builder (replaces the ESBuild `application` builder)

### 2. Switch the Builder in `angular.json`

Angular 20 defaults to `@angular/build:application` (ESBuild). single-spa needs webpack, so switch to the **browser** builder.

**Before:**
```json
"build": {
  "builder": "@angular/build:application",
  "options": {
    "browser": "src/main.ts"
  }
}
```

**After:**
```json
"build": {
  "builder": "@angular-devkit/build-angular:browser",
  "options": {
    "outputPath": "dist/my-angular-app",
    "index": "src/index.html",
    "main": "src/main.single-spa.ts"
  }
}
```

> The `browser` builder requires `outputPath`, `index`, and `main` (not `browser`) properties.

Also update `serve`, `extract-i18n`, and `test` targets to use `@angular-devkit/build-angular:*` builders instead of `@angular/build:*`.

### 3. Add the single-spa Build Target in `angular.json`

Add a separate architect target for the microfrontend build. The key differences from the standard build:
- Uses `@angular-builders/custom-webpack:browser` builder
- Includes `customWebpackConfig` for single-spa's UMD bundling
- Sets `deployUrl` to the microfrontend's dev server URL (fixes lazy chunk loading)
- Uses `outputHashing: "none"` so the shell gets a predictable `main.js` filename

```json
"build-single-spa": {
  "builder": "@angular-builders/custom-webpack:browser",
  "options": {
    "outputPath": "dist/my-angular-app-single-spa",
    "index": "src/index.html",
    "main": "src/main.single-spa.ts",
    "polyfills": ["zone.js"],
    "tsConfig": "tsconfig.app.json",
    "assets": [{ "glob": "**/*", "input": "public" }],
    "styles": ["src/styles.css"],
    "customWebpackConfig": {
      "path": "extra-webpack.config.js",
      "libraryName": "my-angular-app",
      "libraryTarget": "umd"
    },
    "deployUrl": "http://localhost:4002/"
  },
  "configurations": {
    "production": {
      "outputHashing": "none"
    },
    "development": {
      "optimization": false,
      "extractLicenses": false,
      "sourceMap": true
    }
  },
  "defaultConfiguration": "production"
},
"serve-single-spa": {
  "builder": "@angular-builders/custom-webpack:dev-server",
  "options": {
    "buildTarget": "my-angular-app:build-single-spa:development"
  }
}
```

> **Why `deployUrl`?** When the shell at `localhost:61052` loads your microfrontend, webpack defaults to fetching lazy chunks from the shell's origin. `deployUrl` tells webpack to fetch chunks from `http://localhost:4002/` instead — where they actually live. For production, change this to your deployed microfrontend URL.
>
> **Important:** `--deploy-url` does NOT work as a CLI flag with `ng run`. It must be set in `angular.json` options.

### 4. Add npm Scripts

```json
"scripts": {
  "start": "ng serve --port 4002",
  "build": "ng build",
  "build:single-spa": "ng run my-angular-app:build-single-spa",
  "serve:single-spa": "ng run my-angular-app:serve-single-spa --port 4002"
}
```

### 5. Create `extra-webpack.config.js`

This is the custom webpack config that single-spa-angular uses to produce a UMD bundle.

```js
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
```

> **Why remove zone.js from externals?** single-spa-angular assumes the shell provides zone.js globally. But if you want the app to also run standalone, zone.js must stay in the bundle. Loading zone.js twice is harmless — it detects it's already loaded and becomes a no-op.

### 6. Create `src/main.single-spa.ts`

This is the **unified entry point** that works in both standalone and shell modes:

```typescript
// zone.js must be loaded before any Angular code.
// In shell mode, zone.js is already loaded globally (this becomes a no-op).
// In standalone mode, this ensures zone.js is available.
import 'zone.js';

import { NgZone } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { singleSpaAngular, getSingleSpaExtraProviders } from 'single-spa-angular';
import { AppModule } from './app/app-module';
import { singleSpaPropsSubject } from './single-spa/single-spa-props';

// single-spa lifecycle hooks (used when mounted by a shell)
const lifecycles = singleSpaAngular({
  bootstrapFunction: (singleSpaProps) => {
    singleSpaPropsSubject.next(singleSpaProps);
    return platformBrowserDynamic(getSingleSpaExtraProviders()).bootstrapModule(AppModule);
  },
  template: '<app-root />',
  Router,
  NavigationStart,
  NgZone,
});

export const bootstrap = lifecycles.bootstrap;
export const mount = lifecycles.mount;
export const unmount = lifecycles.unmount;

// When running standalone (not loaded by a shell), bootstrap immediately.
// window.singleSpaNavigate exists only when single-spa is controlling the page.
if (!(window as any).singleSpaNavigate) {
  platformBrowserDynamic()
    .bootstrapModule(AppModule, { ngZoneEventCoalescing: true })
    .catch(err => console.error(err));
}
```

**How the standalone detection works:**
- `window.singleSpaNavigate` is a function that single-spa adds to the window when it initializes
- If it exists → shell is in control → export lifecycle hooks and wait for mount
- If it doesn't exist → running standalone → bootstrap Angular immediately

### 7. Create Helper Files

**`src/single-spa/single-spa-props.ts`** — Receives custom props from the shell:

```typescript
import { ReplaySubject } from 'rxjs';
import { AppProps } from 'single-spa';

export const singleSpaPropsSubject = new ReplaySubject<SingleSpaProps>(1);

export type SingleSpaProps = AppProps & {
  // Add any custom single-spa props here
};
```

**`src/single-spa/asset-url.ts`** — Resolves asset paths correctly in both modes:

```typescript
export function assetUrl(url: string): string {
  // @ts-ignore
  const publicPath = __webpack_public_path__;
  const publicPathSuffix = publicPath.endsWith('/') ? '' : '/';
  const urlPrefix = url.startsWith('/') ? '' : '/';
  return `${publicPath}${publicPathSuffix}assets${urlPrefix}${url}`;
}
```

### 8. Set `APP_BASE_HREF` in `AppModule`

When the shell mounts your app at a sub-path (e.g., `/oneui/ang20`), Angular's router needs to know about it. Add `APP_BASE_HREF` in your `AppModule` providers:

```typescript
import { APP_BASE_HREF } from '@angular/common';

@NgModule({
  declarations: [App],
  imports: [BrowserModule, AppRoutingModule],
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: APP_BASE_HREF, useValue: '/oneui/ang20/' }
  ],
  bootstrap: [App],
})
export class AppModule {}
```

> Set the value to match the route path configured in your shell's layout (e.g., `<route path="oneui/ang20">`). Your routing module itself needs no changes.

---

## Running the App

| Command | Mode | Description |
|---|---|---|
| `npm start` | Standalone | Runs as a normal Angular app on port 4002 |
| `npm run serve:single-spa` | Microfrontend dev | Serves the UMD bundle for a shell to load |
| `npm run build:single-spa` | Microfrontend prod | Builds `dist/my-angular-app-single-spa/main.js` for deployment |
| `npm run build` | Standalone prod | Standard Angular production build |

---

## Registering in a Shell Application

In your shell's import map, point to the microfrontend's `main.js`:

```json
{
  "imports": {
    "@org/ang20": "http://localhost:4002/main.js"
  }
}
```

In your shell's layout HTML (using single-spa-layout):

```html
<route path="oneui/ang20">
  <application name="@org/ang20"></application>
</route>
```

The shell's JS registers and starts single-spa:

```javascript
import { constructRoutes, constructApplications, constructLayoutEngine } from 'single-spa-layout';
import { registerApplication, start } from 'single-spa';

const routes = constructRoutes(microfrontendLayout);
const applications = constructApplications({
  routes,
  loadApp({ name }) {
    return System.import(name);
  },
});
const layoutEngine = constructLayoutEngine({ routes, applications, active: false });

applications.forEach(registerApplication);
layoutEngine.activate();
start({ urlRerouteOnly: true });
```

---

## Common Pitfalls and Fixes

### `NG0908: Angular requires Zone.js`

**Cause:** single-spa-angular's webpack helper externalizes `zone.js`, expecting the shell to provide it. When running standalone, zone.js is missing.

**Fix:** Two changes:
1. Add `import 'zone.js'` at the very top of `main.single-spa.ts` (before any Angular imports)
2. In `extra-webpack.config.js`, remove `zone.js` from webpack externals so it stays in the bundle (see Step 5)

### `ChunkLoadError: Loading chunk XXX failed`

**Cause:** When the shell loads the microfrontend, webpack tries to fetch lazy-loaded chunks (e.g., `998.js`) from the shell's origin instead of the microfrontend's dev server.

**Fix:** Set `"deployUrl": "http://localhost:4002/"` in the `build-single-spa` options in `angular.json` (see Step 3). This tells webpack to prefix all chunk URLs with the microfrontend's actual URL.

> `--deploy-url` does NOT work as a CLI argument with `ng run`. It must be set in `angular.json`.

### Builder Mismatch with Angular 17+

**Cause:** Angular 17+ defaults to `@angular/build:application` (ESBuild), which doesn't support custom webpack configs needed by single-spa.

**Fix:** Switch to `@angular-devkit/build-angular:browser` and install `@angular-devkit/build-angular@20`.

### `@angular-builders/custom-webpack` Peer Dependency Error

**Cause:** The latest version targets Angular 21.

**Fix:** Pin to the Angular 20 compatible version: `@angular-builders/custom-webpack@20.0.0`

### Architect Target Naming

**Cause:** Angular CLI doesn't support colons in architect target names (e.g., `build:single-spa`).

**Fix:** Use hyphens instead: `build-single-spa`. Reference via `ng run my-angular-app:build-single-spa`.

---

## Project Structure

```
src/
├── main.single-spa.ts          # Unified entry point (standalone + shell)
├── index.html
├── styles.css
├── single-spa/
│   ├── single-spa-props.ts     # Custom props from shell
│   └── asset-url.ts            # Asset URL resolver
├── app/
│   ├── app-module.ts           # APP_BASE_HREF set here for shell path
│   ├── app-routing-module.ts   # Routes unchanged from standard app
│   ├── app.ts
│   ├── app.html
│   ├── app.css
│   └── pages/
│       ├── home/
│       ├── about/
│       └── contact/
extra-webpack.config.js          # Custom webpack config for single-spa
angular.json                     # Two build targets: standard + single-spa (with deployUrl)
package.json
```

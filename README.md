# Angular 20 → single-spa Microfrontend Conversion Guide

A step-by-step guide for converting a standard Angular 20 (NgModule-based) application into a
**single-spa microfrontend** that can:

- Run **standalone** via `ng serve` (normal Angular app)
- Be **mounted inside a shell** application via single-spa lifecycle hooks

---

## Why This Guide Exists

Angular 20 defaults to the ESBuild-based `@angular/build:application` builder, which **does not
support** the custom webpack config that single-spa requires. The `ng add single-spa-angular`
schematic automates most of the setup, but it needs a builder swap first. This guide covers the
full process including all the manual fixes required after the schematic runs.

---

## Prerequisites

- Angular CLI 20.x project (NgModule-based)
- Node.js 18+
- A shell application that uses single-spa to orchestrate microfrontends (for shell mode)

---

## Step-by-Step Conversion

### Step 1 — Switch the Builder (MUST do before `ng add`)

The `ng add single-spa-angular` schematic expects `@angular-devkit/build-angular:browser`.
Angular 20 ships with `@angular/build:application` (ESBuild), so you must switch first.

**Install the browser builder:**

```bash
npm install @angular-devkit/build-angular@20
```

**Update `angular.json`** — change all four architect targets:

| Target | Before (Angular 20 default) | After |
|---|---|---|
| `build` | `@angular/build:application` | `@angular-devkit/build-angular:browser` |
| `serve` | `@angular/build:dev-server` | `@angular-devkit/build-angular:dev-server` |
| `extract-i18n` | `@angular/build:extract-i18n` | `@angular-devkit/build-angular:extract-i18n` |
| `test` | `@angular/build:karma` | `@angular-devkit/build-angular:karma` |

The `browser` builder also requires different option keys. Change the `build` options:

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
    "main": "src/main.ts"
  }
}
```

> The `browser` builder requires `outputPath`, `index`, and `main` (not `browser`) properties.

**Verify the build still works before proceeding:**

```bash
npx ng build
```

---

### Step 2 — Run `ng add single-spa-angular`

```bash
ng add single-spa-angular --project my-angular-app
```

When prompted:
- **Does your application use Angular routing?** → Yes
- **What port should your project run on?** → 4002 (or your preferred port)

The schematic automatically:
- Installs `single-spa`, `single-spa-angular`, `style-loader`, and `@angular-builders/custom-webpack`
- Generates `src/main.single-spa.ts` (single-spa entry point with lifecycle hooks)
- Generates `src/single-spa/single-spa-props.ts` (custom props helper)
- Generates `src/single-spa/asset-url.ts` (asset URL resolver)
- Generates `src/app/empty-route/empty-route.component.ts` (catch-all route component)
- Creates `extra-webpack.config.js` in the project root
- Adds `build:single-spa` and `serve:single-spa` npm scripts
- Updates `angular.json` with custom-webpack builder and `deployUrl`

> **If `@angular-builders/custom-webpack` fails with a peer dependency error or builder not found:**
> ```bash
> npm install @angular-builders/custom-webpack@20
> ```
> Pin it to version 20 to match your Angular version.

---

### Step 3 — Fix `deployUrl` in `angular.json`

When the shell loads your microfrontend, webpack tries to fetch lazy-loaded chunks from the
shell's origin instead of the microfrontend's dev server. The schematic may already set this,
but verify it's correct in the `build` target options:

```json
"build": {
  "builder": "@angular-builders/custom-webpack:browser",
  "options": {
    "deployUrl": "http://localhost:4002/"
  }
}
```

> For production, change this to your deployed microfrontend URL
> (e.g., `https://cdn.example.com/my-angular-app/`).
>
> `--deploy-url` does **NOT** work as a CLI flag with `ng run`. It must be set in `angular.json`.

---

### Step 4 — Fix zone.js (for standalone mode)

single-spa-angular's webpack helper externalizes `zone.js` (expects the shell to provide it).
If you want the app to also run standalone, you need zone.js in the bundle. Two changes:

**a) Add `import 'zone.js'` at the very top of `src/main.single-spa.ts`:**

```typescript
import 'zone.js';  // ← ADD THIS AS THE FIRST LINE
import { enableProdMode, NgZone } from '@angular/core';
// ... rest of the file
```

**b) Remove zone.js from webpack externals in `extra-webpack.config.js`:**

Replace the generated file with:

```js
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
```

---

### Step 5 — Fix `main.single-spa.ts` imports and add standalone bootstrap

The schematic generates `main.single-spa.ts` with references that may not match your project.
Fix the imports and add standalone bootstrap support.

**Issues to fix:**
- The schematic imports from `./app/app.module` — your file may be named differently
  (e.g., `./app/app-module`)
- The schematic imports `./environments/environment` — this file may not exist in your project
- No standalone bootstrap is included — the app won't work outside a shell

**Final working `src/main.single-spa.ts`:**

```typescript
import 'zone.js';
import { enableProdMode, NgZone } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { Router, NavigationStart } from '@angular/router';
import { singleSpaAngular, getSingleSpaExtraProviders } from 'single-spa-angular';

import { AppModule } from './app/app-module';
import { singleSpaPropsSubject } from './single-spa/single-spa-props';

const lifecycles = singleSpaAngular({
  bootstrapFunction: singleSpaProps => {
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
  platformBrowserDynamic().bootstrapModule(AppModule, { ngZoneEventCoalescing: true })
    .catch(err => console.error(err));
}
```

> Adjust the `AppModule` import path to match your project's file naming convention.

---

### Step 6 — Delete the old `src/main.ts`

Since `main.single-spa.ts` now handles both standalone and shell modes, delete the original
entry point:

```bash
rm src/main.ts
```

The `angular.json` build target already points to `src/main.single-spa.ts` (set by the schematic).

---

### Step 7 — Wire up `EmptyRouteComponent`

The schematic generates `src/app/empty-route/empty-route.component.ts` as a standalone component.
Since this is an NgModule-based app, you need to:

**a) Set `standalone: false` on the component:**

```typescript
// src/app/empty-route/empty-route.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-empty-route',
  standalone: false,
  template: '',
})
export class EmptyRouteComponent {}
```

**b) Declare it in `AppModule`:**

```typescript
import { EmptyRouteComponent } from './empty-route/empty-route.component';

@NgModule({
  declarations: [App, EmptyRouteComponent],
  // ...
})
export class AppModule {}
```

**c) Add the catch-all route (MUST be last) in your routing module:**

```typescript
import { EmptyRouteComponent } from './empty-route/empty-route.component';

const routes: Routes = [
  // ... your existing routes ...
  { path: '**', component: EmptyRouteComponent },  // MUST BE LAST
];
```

---

### Step 8 — Set `APP_BASE_HREF` in `AppModule`

When the shell mounts your app at a sub-path (e.g., `/oneui/ang20`), Angular's router needs
to know about it:

```typescript
import { APP_BASE_HREF } from '@angular/common';

@NgModule({
  declarations: [App, EmptyRouteComponent],
  imports: [BrowserModule, AppRoutingModule],
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: APP_BASE_HREF, useValue: '/oneui/ang20/' },
  ],
  bootstrap: [App],
})
export class AppModule {}
```

> Set the value to match the route path in your shell's layout.

---

### Step 9 — Clean up npm scripts

The schematic generates verbose script names. Simplify them in `package.json`:

```json
"scripts": {
  "ng": "ng",
  "start": "ng serve --port 4002",
  "build": "ng build",
  "watch": "ng build --watch --configuration development",
  "test": "ng test",
  "build:single-spa": "ng build my-angular-app --configuration production",
  "serve:single-spa": "ng s --project my-angular-app --disable-host-check --port 4002 --live-reload false"
}
```

---

### Step 10 — Verify

```bash
# Production build
npx ng build --configuration production

# Development build
npx ng build --configuration development

# Standalone mode (runs as normal Angular app)
npm start

# Microfrontend mode (serves UMD bundle for shell)
npm run serve:single-spa
```

All four commands should succeed.

---

## Summary of Changes

| What | Automated by `ng add` | Manual fix needed |
|---|---|---|
| Install single-spa packages | ✅ | Pin `@angular-builders/custom-webpack@20` if builder not found |
| Generate `main.single-spa.ts` | ✅ | Fix imports + add `import 'zone.js'` + add standalone bootstrap |
| Generate `extra-webpack.config.js` | ✅ | Remove zone.js from externals |
| Generate helper files (`single-spa/`) | ✅ | — |
| Generate `EmptyRouteComponent` | ✅ | Set `standalone: false`, declare in module, add catch-all route |
| Add build/serve scripts | ✅ | Simplify script names (optional) |
| Add `deployUrl` | ✅ | Verify port is correct |
| Switch builder to `browser` | ❌ | **Must do BEFORE running `ng add`** |
| Delete old `src/main.ts` | ❌ | Delete manually |
| Set `APP_BASE_HREF` | ❌ | Set to match shell's mount path |

---

## Running the App

| Command | Mode | Description |
|---|---|---|
| `npm start` | Standalone | Runs as a normal Angular app on port 4002 |
| `npm run serve:single-spa` | Microfrontend dev | Serves the UMD bundle for a shell to load |
| `npm run build:single-spa` | Microfrontend prod | Builds `dist/my-angular-app/main.js` for deployment |
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

Register in the shell's JavaScript:

```javascript
import { registerApplication, start } from 'single-spa';

registerApplication({
  name: '@org/ang20',
  app: () => System.import('@org/ang20'),
  activeWhen: ['/oneui/ang20'],
});

start({ urlRerouteOnly: true });
```

---

## Common Pitfalls and Fixes

### `NG0908: Angular requires Zone.js`

**Cause:** single-spa-angular's webpack helper externalizes `zone.js`, expecting the shell to
provide it.

**Fix:** Add `import 'zone.js'` at the top of `main.single-spa.ts` + remove zone.js from
externals in `extra-webpack.config.js` (Steps 4a and 4b).

### `ChunkLoadError: Loading chunk XXX failed`

**Cause:** Webpack fetches lazy chunks from the shell's origin instead of the microfrontend's
dev server.

**Fix:** Set `"deployUrl": "http://localhost:4002/"` in the build options in `angular.json`
(Step 3).

### Builder Not Found: `@angular-builders/custom-webpack:browser`

**Cause:** The schematic installed `@angular-builders/custom-webpack@latest` which may target
a newer Angular version.

**Fix:** `npm install @angular-builders/custom-webpack@20`

### `--deploy-url` as CLI Flag Doesn't Work

**Cause:** `ng run` doesn't accept `--deploy-url` as a command-line argument.

**Fix:** Set `"deployUrl"` inside `angular.json` options instead.

### Schematic References Wrong Module Path

**Cause:** The schematic generates `import { AppModule } from './app/app.module'` but your
file may be named `app-module.ts` (or similar).

**Fix:** Update the import path in `main.single-spa.ts` to match your actual file name.

### Schematic References Missing `environments/environment`

**Cause:** The schematic generates `import { environment } from './environments/environment'`
and an `if (environment.production) { enableProdMode(); }` block. Angular 20 projects may not
have this file.

**Fix:** Remove the import and the `enableProdMode()` block. Angular 20 handles production
mode via build configuration.

---

## Final Project Structure

```
src/
├── main.single-spa.ts          # Unified entry point (standalone + shell)
├── index.html
├── styles.css
├── single-spa/
│   ├── single-spa-props.ts     # Custom props from shell (generated by ng add)
│   └── asset-url.ts            # Asset URL resolver (generated by ng add)
├── app/
│   ├── app-module.ts           # Root module — APP_BASE_HREF set here
│   ├── app-routing-module.ts   # Routes + EmptyRouteComponent catch-all
│   ├── app.ts                  # Root component
│   ├── app.html
│   ├── app.css
│   ├── empty-route/
│   │   └── empty-route.component.ts  # Generated by ng add, set standalone: false
│   └── pages/
│       ├── home/
│       ├── about/
│       └── contact/
extra-webpack.config.js          # Custom webpack config (zone.js fix applied)
angular.json                     # Builder: custom-webpack:browser, deployUrl set
package.json                     # single-spa scripts added
```

# Angular 20 Single-SPA Shell Application

An Angular 20 (NgModule-based) shell application that uses **single-spa** to load the **FND Unified Workflow UI** as a microfrontend. The shell runs on port 4002 and loads the FND app (running on port 4200) when the user navigates to `/oneui/ew`.

---

## Quick Start

```bash
# 1. Start the FND microfrontend (must be running first)
cd FND_Unified_Workflow_UI
npm start
# → runs on http://localhost:4200

# 2. Start the shell
cd ShellAng20/my-angular-app
npm start
# → runs on http://localhost:4002

# 3. Open http://localhost:4002 in your browser
# Click "FND" in the nav bar (or go to /oneui/ew) to load the microfrontend
```

---

## Project Structure

```
src/
├── main.ts                          # Bootstraps Angular + registers FND microfrontend with single-spa
├── index.html                       # SystemJS loader + import map pointing to FND bundle
├── styles.css                       # Global styles
├── app/
│   ├── app-module.ts                # Root NgModule
│   ├── app-routing-module.ts        # Shell routes + catch-all for microfrontend routes
│   ├── app.ts                       # Root component
│   ├── app.html                     # Nav bar + router-outlet + single-spa mount point
│   ├── app.css                      # Nav styles
│   ├── empty-route/
│   │   └── empty-route.ts           # Blank component for microfrontend route catch-all
│   └── pages/
│       ├── home/                    # Home page (lazy-loaded)
│       ├── about/                   # About page (lazy-loaded)
│       └── contact/                 # Contact page (lazy-loaded)
```

---

## How It Works

The shell is a normal Angular app that also initializes single-spa to manage microfrontends. Angular owns the layout (nav bar, shared UI) and its own routes. Single-spa handles loading/unloading the FND microfrontend based on URL.

### The 5 key pieces:

1. **`main.ts`** — Bootstraps Angular, then registers the FND app with single-spa
2. **`index.html`** — Loads SystemJS and defines the import map (where to fetch FND's bundle)
3. **`app.html`** — Contains a `<div id="single-spa-application:@org/fnd">` where FND mounts
4. **`app-routing-module.ts`** — Has a `**` catch-all route so Angular doesn't error on `/oneui/ew`
5. **`empty-route.ts`** — The blank component used by the catch-all route

---

## Setup Guide (Step by Step)

If you're setting this up from scratch in a new Angular 20 project, here's exactly what to do.

### Step 1: Install single-spa

```bash
npm install single-spa
```

This is the only required dependency for the shell. (`single-spa-angular` and `@angular-builders/custom-webpack` are only needed if this app were being loaded AS a microfrontend by another shell — not needed here.)

### Step 2: Configure `src/index.html`

Add SystemJS and the import map before the closing `</head>` tag:

```html
<!-- SystemJS Import Map for Microfrontends -->
<script type="systemjs-importmap">
  {
    "imports": {
      "single-spa": "https://cdn.jsdelivr.net/npm/single-spa@6.0.3/lib/es2015/system/single-spa.min.js",
      "@org/fnd": "http://localhost:4200/main.js"
    }
  }
</script>

<!-- SystemJS Module Loader -->
<script src="https://cdn.jsdelivr.net/npm/systemjs@6.15.1/dist/system.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/systemjs@6.15.1/dist/extras/amd.min.js"></script>
```

- **`@org/fnd`** points to the FND app's UMD bundle at `http://localhost:4200/main.js`
- **`system.min.js`** is the SystemJS runtime that loads UMD modules at runtime
- **`extras/amd.min.js`** adds AMD support (Angular microfrontend bundles use UMD which includes AMD)

### Step 3: Configure `src/main.ts`

```typescript
import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app-module';
import { registerApplication, start } from 'single-spa';

declare const System: any;

// Bootstrap the Angular shell
platformBrowser().bootstrapModule(AppModule, {
  ngZoneEventCoalescing: true,
}).catch(err => console.error(err));

// Register FND microfrontend
registerApplication({
  name: '@org/fnd',
  app: () => System.import('@org/fnd'),
  activeWhen: ['/oneui/ew'],
});

// Start single-spa
start({ urlRerouteOnly: true });
```

- **`registerApplication`**: The `name` must match the import map key. `activeWhen: ['/oneui/ew']` means FND loads on any URL starting with `/oneui/ew`.
- **`declare const System: any`**: TypeScript declaration for the SystemJS global loaded in index.html.
- **`urlRerouteOnly: true`**: Single-spa only triggers app changes on actual URL changes.

### Step 4: Create `src/app/empty-route/empty-route.ts`

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-empty-route',
  standalone: false,
  template: '',
})
export class EmptyRouteComponent {}
```

This blank component prevents Angular from throwing "route not found" errors on URLs owned by microfrontends.

### Step 5: Add the catch-all route in `app-routing-module.ts`

```typescript
const routes: Routes = [
  { path: '', loadChildren: () => import('./pages/home/home.module').then(m => m.HomeModule) },
  { path: 'about', loadChildren: () => import('./pages/about/about.module').then(m => m.AboutModule) },
  { path: 'contact', loadChildren: () => import('./pages/contact/contact.module').then(m => m.ContactModule) },
  // Catch-all for microfrontend routes — MUST BE LAST
  { path: '**', component: EmptyRouteComponent },
];
```

Don't forget to add `EmptyRouteComponent` to your module's `declarations` array.

### Step 6: Add the mount point in `app.html`

```html
<nav>
  <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
  <a routerLink="/about" routerLinkActive="active">About</a>
  <a routerLink="/contact" routerLinkActive="active">Contact</a>
  <a routerLink="/oneui/ew" routerLinkActive="active">FND</a>
</nav>
<router-outlet />
<div id="single-spa-application:@org/fnd"></div>
```

- The `<div id="single-spa-application:@org/fnd">` is where single-spa mounts the FND app's DOM. The ID format `single-spa-application:<app-name>` is a single-spa convention.
- The `routerLink="/oneui/ew"` nav link triggers the route that activates the FND microfrontend.

---

## FND Microfrontend Requirements

The FND app (running on port 4200) must be configured as a single-spa microfrontend:

- Built with `@angular-builders/custom-webpack` to output a UMD bundle
- Exports single-spa lifecycle functions (`bootstrap`, `mount`, `unmount`)
- Uses `single-spa-angular` to wrap the Angular app
- Serves `main.js` as the entry bundle at `http://localhost:4200/main.js`
- Its routes should be prefixed with `/oneui/ew` to match the shell's `activeWhen` config

---

## Adding Another Microfrontend

1. Add its URL to the import map in `index.html`:
   ```json
   "@myorg/new-mfe": "http://localhost:4201/main.js"
   ```

2. Register it in `main.ts`:
   ```typescript
   registerApplication({
     name: '@myorg/new-mfe',
     app: () => System.import('@myorg/new-mfe'),
     activeWhen: ['/new-mfe-route'],
   });
   ```

3. Add a mount point in `app.html`:
   ```html
   <div id="single-spa-application:@myorg/new-mfe"></div>
   ```

4. Optionally add a nav link:
   ```html
   <a routerLink="/new-mfe-route">New MFE</a>
   ```

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| FND doesn't load on `/oneui/ew` | FND app not running | Start FND on port 4200 first |
| Console error: `System.import is not a function` | SystemJS not loaded | Check that `system.min.js` script tag is in `index.html` |
| Angular "route not found" error | Missing catch-all route | Ensure `{ path: '**', component: EmptyRouteComponent }` is the last route |
| FND loads but styles are missing | CSS not bundled in FND's UMD output | Check FND's webpack config includes styles in the bundle |
| CORS errors loading `main.js` | FND dev server blocks cross-origin | Add `--disable-host-check` to FND's serve command or configure CORS headers |
| FND mounts but shows blank | Wrong mount point ID | Ensure `<div id="single-spa-application:@org/fnd">` exists in `app.html` |

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Browser — http://localhost:4002                 │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │  Angular 20 Shell                           │  │
│  │  ├── Nav: Home | About | Contact | FND      │  │
│  │  ├── Angular Router (own pages)             │  │
│  │  └── single-spa (microfrontend orchestrator)│  │
│  └─────────────────────────────────────────────┘  │
│                        │                          │
│            ┌───────────┴───────────┐              │
│            ▼                       ▼              │
│  ┌──────────────────┐   ┌──────────────────┐     │
│  │  Shell Routes     │   │  Microfrontends  │     │
│  │  /     → Home     │   │  /oneui/ew →     │     │
│  │  /about → About   │   │    @org/fnd      │     │
│  │  /contact         │   │    (port 4200)   │     │
│  │  /** → EmptyRoute │   │                  │     │
│  └──────────────────┘   └──────────────────┘     │
└──────────────────────────────────────────────────┘
```

---

## Ports

| App | Port | Role |
|---|---|---|
| ShellAng20 (this app) | 4002 | Shell / root config |
| FND Unified Workflow UI | 4200 | Microfrontend |

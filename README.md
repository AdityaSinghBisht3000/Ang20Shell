# Mounting a Single-SPA Parcel in an Angular 20 Shell

This guide documents how this Angular 20 shell application mounts a **single-spa parcel** served by a separate Angular 17 app (the parcel provider). The parcel provider exposes a component as a UMD bundle, and this shell loads and renders it on a button click via routing.

---

## Architecture Overview

```
┌─────────────────────────────────────┐
│  Angular 20 Shell (port 4002)       │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ Nav: Home | Stats Widget | …  │  │
│  ├───────────────────────────────┤  │
│  │ <router-outlet>               │  │
│  │                               │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ ParcelWidgetComponent   │  │  │
│  │  │                         │  │  │
│  │  │  SystemJS.import()      │  │  │
│  │  │  mountRootParcel()      │  │  │
│  │  │       ↓                 │  │  │
│  │  │  ┌───────────────────┐  │  │  │
│  │  │  │ Ang17 StatsWidget │  │  │  │
│  │  │  │ (parcel bundle)   │  │  │  │
│  │  │  └───────────────────┘  │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
         ↑ loads JS bundle from
┌─────────────────────────────────────┐
│  Angular 17 Parcel Provider         │
│  (port 5202)                        │
│  serves: stats-widget-parcel.js     │
└─────────────────────────────────────┘
```

---

## Prerequisites

- The parcel provider app must expose a UMD bundle with `bootstrap`, `mount`, and `unmount` lifecycle functions (see the `Ang17/PARCEL2_GUIDE.md` for how to set that up).
- The parcel provider must serve with CORS headers (`Access-Control-Allow-Origin: *`).
- The parcel provider must use `outputHashing: "none"` so bundle filenames are predictable.

---

## Step-by-Step Implementation

### Step 1: Install `single-spa` in the Shell

```bash
npm install single-spa
```

This gives you `mountRootParcel()` — the function that takes a parcel's lifecycle object and mounts it into a DOM element.

---

### Step 2: Add SystemJS to `index.html`

SystemJS is needed to load the parcel's UMD bundle at runtime. Add these scripts and an import map to `src/index.html`:

```html
<head>
  <!-- ... existing tags ... -->

  <!-- SystemJS loader -->
  <script src="https://cdn.jsdelivr.net/npm/systemjs@6.14.2/dist/system.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/systemjs@6.14.2/dist/extras/amd.min.js"></script>

  <!-- Import map: maps a logical name to the parcel bundle URL -->
  <script type="systemjs-importmap">
    {
      "imports": {
        "@org/stats-widget": "http://localhost:5202/stats-widget-parcel.js"
      }
    }
  </script>
</head>
```

**Key points:**
- `system.min.js` — the SystemJS module loader
- `extras/amd.min.js` — required because the parcel bundle is in UMD/AMD format
- The import map key (`@org/stats-widget`) is the name you'll use in `System.import()`
- The URL points to the parcel bundle served by the provider app

---

### Step 3: Create the Parcel Wrapper Component

Create `src/app/pages/parcel-widget/parcel-widget.ts`:

```typescript
import {
  Component,
  AfterViewInit,
  OnDestroy,
  NgZone,
  ViewEncapsulation,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { mountRootParcel } from 'single-spa';

declare const System: any;

const PARCEL_STYLE_URLS = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/primeicons@7.0.0/primeicons.css',
  'https://cdn.jsdelivr.net/npm/primeng@17.18.15/resources/themes/lara-light-blue/theme.css',
  'https://cdn.jsdelivr.net/npm/primeng@17.18.15/resources/primeng.min.css',
];

@Component({
  selector: 'app-parcel-widget',
  standalone: false,
  encapsulation: ViewEncapsulation.None,
  template: `
    <h2>Stats Widget (Parcel from Ang17)</h2>
    <div #parcelContainer></div>
    @if (error) {
      <p style="color:red">{{ error }}</p>
    }
  `,
  styles: [`:host { display: block; padding: 1rem; }`],
})
export class ParcelWidgetComponent implements AfterViewInit, OnDestroy {
  @ViewChild('parcelContainer', { static: true })
  container!: ElementRef<HTMLDivElement>;
  error = '';
  private parcel: any;
  private styleLinks: HTMLLinkElement[] = [];

  constructor(private ngZone: NgZone) {}

  async ngAfterViewInit() {
    this.loadParcelStyles();

    this.ngZone.runOutsideAngular(async () => {
      try {
        const app = await System.import('@org/stats-widget');
        this.parcel = mountRootParcel(app, {
          domElement: this.container.nativeElement,
        });
      } catch (err: any) {
        this.ngZone.run(() => {
          this.error =
            'Failed to load parcel. Is the provider running on port 5202?';
          console.error('Parcel mount error:', err);
        });
      }
    });
  }

  ngOnDestroy() {
    if (this.parcel) {
      this.parcel.unmount();
    }
    this.removeParcelStyles();
  }

  private loadParcelStyles(): void {
    for (const url of PARCEL_STYLE_URLS) {
      if (document.querySelector(`link[href="${url}"]`)) {
        continue;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      document.head.appendChild(link);
      this.styleLinks.push(link);
    }
  }

  private removeParcelStyles(): void {
    for (const link of this.styleLinks) {
      link.parentNode?.removeChild(link);
    }
    this.styleLinks = [];
  }
}
```

**What this does:**
1. `ngAfterViewInit` — loads the parcel bundle via SystemJS and mounts it into the `#parcelContainer` div
2. `ngOnDestroy` — unmounts the parcel and removes injected stylesheets
3. `runOutsideAngular` — prevents the parcel's zone from triggering change detection in the shell
4. `ViewEncapsulation.None` — allows the parcel's styles to apply without Angular's style scoping

---

### Step 4: Create the Wrapper Module

Create `src/app/pages/parcel-widget/parcel-widget.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ParcelWidgetComponent } from './parcel-widget';

@NgModule({
  declarations: [ParcelWidgetComponent],
  imports: [
    CommonModule,
    RouterModule.forChild([{ path: '', component: ParcelWidgetComponent }]),
  ],
})
export class ParcelWidgetModule {}
```

---

### Step 5: Add the Route

In `src/app/app-routing-module.ts`, add a lazy-loaded route:

```typescript
{
  path: 'parcel-widget',
  loadChildren: () =>
    import('./pages/parcel-widget/parcel-widget.module')
      .then(m => m.ParcelWidgetModule),
}
```

---

### Step 6: Add the Navigation Link

In `src/app/app.html`, add a link next to the existing nav items:

```html
<nav>
  <a routerLink="/" routerLinkActive="active"
     [routerLinkActiveOptions]="{ exact: true }">Home</a>
  <a routerLink="/parcel-widget" routerLinkActive="active">Stats Widget</a>
  <a routerLink="/about" routerLinkActive="active">About</a>
  <a routerLink="/contact" routerLinkActive="active">Contact</a>
</nav>
<router-outlet />
```

---

## Running It

```bash
# Terminal 1 — Start the parcel provider (Ang17)
cd Ang17
npm run serve:parcel    # serves on port 5202

# Terminal 2 — Start the shell (ShellAng20)
cd ShellAng20/my-angular-app
npm start               # serves on port 4002
```

Open `http://localhost:4002` and click "Stats Widget" in the nav.

---

## The CSS Problem and How to Solve It

This is the most common issue when mounting parcels. Here's what happens and why.

### The Problem

In dev mode, Angular's webpack config uses `style-loader` to bundle **all global CSS** (Bootstrap, PrimeNG, icon fonts, your `styles.scss`) inside `main.js`. At runtime, `main.js` injects them as `<style>` tags into the DOM.

When the shell loads only `stats-widget-parcel.js`, it gets just the component code with its inline styles. The global CSS that makes Bootstrap grid, PrimeNG buttons/tags, and icon fonts work **never gets loaded** — because it's all trapped inside `main.js`, which the shell never imports.

Hitting `http://localhost:5202/styles.css` returns **404** in dev mode. There is no separate CSS file.

### The Solution

Load the same CSS libraries the parcel depends on. You have three options:

#### Option A: CDN (what this project uses — best for dev)

Dynamically inject `<link>` tags pointing to CDN-hosted versions of the same libraries. Match the exact versions from the parcel provider's `node_modules`.

```typescript
const PARCEL_STYLE_URLS = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/primeicons@7.0.0/primeicons.css',
  'https://cdn.jsdelivr.net/npm/primeng@17.18.15/resources/themes/lara-light-blue/theme.css',
  'https://cdn.jsdelivr.net/npm/primeng@17.18.15/resources/primeng.min.css',
];
```

Pros: Works immediately, no build changes needed on the provider side.
Cons: Requires internet access, version must be kept in sync manually.

#### Option B: Production build (best for prod)

In production builds (`ng build`), Angular extracts CSS into a real `styles.css` file by default. With `outputHashing: "none"`, the file is at a predictable URL:

```
http://your-cdn.com/ang17-parcel-poc/styles.css
```

Load that single file instead of multiple CDN links.

#### Option C: Install the same packages in the shell

If the shell also uses Bootstrap/PrimeNG, just add them to the shell's `angular.json` styles array. The parcel will inherit them automatically. This is the cleanest approach when both apps share the same design system.

### Cleanup on Unmount

Always remove injected stylesheets when the parcel is destroyed to prevent style bleed:

```typescript
ngOnDestroy() {
  this.parcel?.unmount();
  for (const link of this.styleLinks) {
    link.parentNode?.removeChild(link);
  }
}
```

---

## Adding More Parcels

To mount additional parcels from the same or different provider apps:

1. Add a new entry in the SystemJS import map in `index.html`:
   ```html
   "@org/another-widget": "http://localhost:5203/another-widget-parcel.js"
   ```

2. Create a new wrapper component following the same pattern as `ParcelWidgetComponent` — update the `System.import()` name and the `PARCEL_STYLE_URLS` to match the new parcel's dependencies.

3. Add a route and nav link.

Each parcel is independent — it creates its own Angular zone and module instance, so they don't interfere with each other or the shell.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Failed to load parcel" error | Provider app not running | Start it with `npm run serve:parcel` |
| CORS error in console | Missing CORS headers on provider | Add `"Access-Control-Allow-Origin": "*"` in provider's `angular.json` serve headers |
| Component renders but looks unstyled | Global CSS not loaded (see above) | Load CSS via CDN, production `styles.css`, or install packages in shell |
| `System is not defined` | SystemJS not loaded | Check that `system.min.js` script tag is in `index.html` |
| `AMD module not found` | Missing AMD extra | Add `extras/amd.min.js` script tag after `system.min.js` |
| Bundle filename has hash (`main.abc123.js`) | `outputHashing` not disabled | Set `"outputHashing": "none"` in ALL build configs of the provider |
| Icons missing but layout works | PrimeIcons CSS not loaded | Add the PrimeIcons CDN link to `PARCEL_STYLE_URLS` |

---

## Files Modified/Created in This Shell

| File | Change |
|------|--------|
| `package.json` | Added `single-spa` dependency |
| `src/index.html` | Added SystemJS scripts and import map |
| `src/app/app.html` | Added "Stats Widget" nav link |
| `src/app/app-routing-module.ts` | Added `parcel-widget` lazy route |
| `src/app/pages/parcel-widget/parcel-widget.ts` | **Created** — wrapper component |
| `src/app/pages/parcel-widget/parcel-widget.module.ts` | **Created** — wrapper module |

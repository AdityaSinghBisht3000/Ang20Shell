# Prompt for AI Agent — Fix NG04002 in Parcel Service

## Context

We have a micro-frontend setup using single-spa:

- Our Angular 17 application runs standalone with hash-based routing (`useHash: true`). URLs look like `localhost:4200/#/search`.
- This same application also serves its home page as a single-spa parcel to an external Angular 20 shell application.
- The shell application uses path-based routing (no hash). It mounts our parcel at route `/oneui/ew`.

## Problem

When the shell mounts our parcel, it bootstraps successfully but throws:

```
NG04002: Cannot match any routes
```

This happens because:
1. Our app uses `HashLocationStrategy` (reads routes from `#/...` in the URL).
2. The shell uses `PathLocationStrategy` (routes are in the URL path like `/oneui/ew`).
3. When our parcel bootstraps inside the shell, our router tries to match `/oneui/ew` as a hash route and fails — none of our hash-based routes match a path-based URL.

## Constraints

- We must ONLY modify the parcel service file (the file that exports `bootstrap`, `mount`, `unmount` lifecycle functions).
- We must NOT change any existing application files — no changes to `app-routing.module.ts`, no changes to any module, component, or routing config.
- The application must continue to work exactly as-is in standalone mode with hash routing.

## Required Fix (in parcel service file only)

In the parcel service file, override routing providers at bootstrap time so that when running as a parcel:

1. Override `LocationStrategy` from `HashLocationStrategy` to `PathLocationStrategy` — so the parcel's router reads the URL path instead of the hash fragment, matching the shell's routing strategy.

2. Set `APP_BASE_HREF` to `'/oneui/ew/'` — so the parcel's router scopes its routes correctly under the shell's mount path.

3. After bootstrap, use `Router.resetConfig()` to append a wildcard catch-all route (`{ path: '**', component }` with an inline empty template component) to the end of the existing routes. This prevents `NG04002` for any unmatched sub-routes without modifying the original routing module.

These overrides only apply when the app is bootstrapped as a parcel. The standalone app remains completely untouched.

## Technical Approach

Use `single-spa-angular`'s `singleSpaAngular()` function. Pass the overridden providers in the `providers` array. In the `bootstrapFunction` callback, after `platformBrowserDynamic().bootstrapModule()` resolves, get the `Router` from the module ref's injector and call `resetConfig()` to append the wildcard route to the existing `router.config`.

Do not create any new files outside the parcel service. Do not modify any existing application files.

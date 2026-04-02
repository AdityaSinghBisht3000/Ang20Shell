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

// When running standalone (not loaded by a shell), bootstrap immediately
if (!(window as any).singleSpaNavigate) {
  platformBrowserDynamic()
    .bootstrapModule(AppModule, { ngZoneEventCoalescing: true })
    .catch(err => console.error(err));
}

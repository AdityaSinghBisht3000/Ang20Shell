import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app-module';
import { registerApplication, start } from 'single-spa';

declare const System: any;

// Bootstrap the Angular shell application
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
console.log('Single-SPA shell started.');

import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { APP_BASE_HREF } from '@angular/common';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { EmptyRouteComponent } from './empty-route/empty-route.component';

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

import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { APP_BASE_HREF } from '@angular/common';

@NgModule({
  declarations: [App],
  imports: [BrowserModule, AppRoutingModule],
  providers: [provideBrowserGlobalErrorListeners(), { provide: APP_BASE_HREF, useValue: '/oneui/ang20/' }],
  bootstrap: [App],
})
export class AppModule {}

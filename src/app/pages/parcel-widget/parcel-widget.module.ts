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

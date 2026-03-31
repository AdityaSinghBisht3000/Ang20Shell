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

/**
 * The Ang17 dev server bundles all CSS into main.js (style-loader).
 * There is no standalone styles.css file in dev mode.
 * We load the same libraries from CDN so the parcel renders correctly.
 */
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
  @ViewChild('parcelContainer', { static: true }) container!: ElementRef<HTMLDivElement>;
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
          this.error = 'Failed to load parcel. Is Ang17 running on port 5202?';
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

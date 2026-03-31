import { Component, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('my-angular-app');

  /** true when a microfrontend route is active — hides shell UI */
  isMfeActive = false;

  constructor(private router: Router) {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map((e: NavigationEnd) => e.urlAfterRedirects || e.url)
    ).subscribe(url => {
      this.isMfeActive = url.startsWith('/oneui/ew');
    });
  }
}

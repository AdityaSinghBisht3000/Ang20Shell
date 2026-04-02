import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: false,
  template: `
    <div class="page">
      <h1>About</h1>
      <p>This is a simple Angular 20 standalone application.</p>
      <ul>
        <li>Angular 20 with standalone components</li>
        <li>Lazy-loaded routes</li>
        <li>Router with navigation</li>
      </ul>
    </div>
  `,
  styles: [`
    .page { padding: 2rem; }
    h1 { color: #1976d2; margin-bottom: 1rem; }
    p { color: #555; line-height: 1.6; }
    ul { margin-top: 1rem; color: #555; }
    li { margin-bottom: 0.5rem; }
  `]
})
export class AboutComponent {}

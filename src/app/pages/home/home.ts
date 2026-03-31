import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  standalone: false,
  template: `
    <div class="page">
      <h1>Home</h1>
      <p>Welcome to our Angular 20 module-based application.</p>
      <p>Use the navigation above to explore different pages.</p>
    </div>
  `,
  styles: [`
    .page { padding: 2rem; }
    h1 { color: #1976d2; margin-bottom: 1rem; }
    p { color: #555; line-height: 1.6; }
  `]
})
export class HomeComponent {}

import { Component } from '@angular/core';

@Component({
  selector: 'app-contact',
  standalone: false,
  template: `
    <div class="page">
      <h1>Contact</h1>
      <p>Get in touch with us.</p>
      <form (ngSubmit)="onSubmit()">
        <div class="form-group">
          <label for="name">Name</label>
          <input id="name" type="text" placeholder="Your name">
        </div>
        <div class="form-group">
          <label for="email">Email</label>
          <input id="email" type="email" placeholder="Your email">
        </div>
        <div class="form-group">
          <label for="message">Message</label>
          <textarea id="message" rows="4" placeholder="Your message"></textarea>
        </div>
        <button type="submit">Send</button>
      </form>
    </div>
  `,
  styles: [`
    .page { padding: 2rem; max-width: 500px; }
    h1 { color: #1976d2; margin-bottom: 1rem; }
    p { color: #555; margin-bottom: 1.5rem; }
    .form-group { margin-bottom: 1rem; }
    label { display: block; margin-bottom: 0.25rem; color: #333; font-weight: 500; }
    input, textarea {
      width: 100%; padding: 0.5rem; border: 1px solid #ccc;
      border-radius: 4px; font-size: 1rem; box-sizing: border-box;
    }
    button {
      background: #1976d2; color: white; border: none;
      padding: 0.6rem 1.5rem; border-radius: 4px; font-size: 1rem; cursor: pointer;
    }
    button:hover { background: #1565c0; }
  `]
})
export class ContactComponent {
  onSubmit() {
    alert('Message sent (demo)');
  }
}

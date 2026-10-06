import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Navbar } from './shared/navbar/navbar';
import { Sidebar } from './shared/sidebar/sidebar';
import { UiService } from './core/services/ui';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Navbar, Sidebar],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly ui = inject(UiService);
}
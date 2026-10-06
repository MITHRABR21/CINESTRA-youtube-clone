import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

import { UiService } from '../../core/services/ui';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar {
  readonly ui = inject(UiService);
  private readonly router = inject(Router);

  readonly searchQuery = signal('');

  constructor() {
    this.syncSearchQuery();

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.syncSearchQuery();
        this.ui.closeMobileMenu();
      });
  }

  onSearchInput(event: Event): void {
    const input = event.target;

    if (input instanceof HTMLInputElement) {
      this.searchQuery.set(input.value);
    }
  }

  submitSearch(event: Event): void {
    event.preventDefault();

    const query = this.searchQuery().trim();

    if (!query) {
      return;
    }

    void this.router.navigate(['/search'], {
      queryParams: { q: query }
    });
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  toggleMenu(): void {
    if (window.matchMedia('(max-width: 900px)').matches) {
      this.ui.toggleMobileMenu();
    } else {
      this.ui.toggleSidebar();
    }
  }

  private syncSearchQuery(): void {
    const url = this.router.parseUrl(this.router.url);

    this.searchQuery.set(url.queryParams['q'] ?? '');
  }
}
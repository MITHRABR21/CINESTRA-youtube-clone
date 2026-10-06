import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UiService {
  readonly sidebarExpanded = signal(true);
  readonly mobileMenuOpen = signal(false);

  toggleSidebar(): void {
    this.sidebarExpanded.update(expanded => !expanded);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(open => !open);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
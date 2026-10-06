import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { UiService } from '../../core/services/ui';
import { LibraryService } from '../../core/services/library';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class Sidebar {
  readonly ui = inject(UiService);
  readonly library = inject(LibraryService);

  readonly mainLinks = [
    {
      label: 'Home',
      route: '/',
      icon: 'home',
      exact: true
    },
    {
      label: 'Shorts',
      route: '/shorts',
      icon: 'shorts',
      exact: false
    },
    {
      label: 'Your library',
      route: '/library',
      icon: 'library',
      exact: true
    }
  ];

  readonly collectionLinks = [
    {
      label: 'History',
      section: 'history',
      icon: 'history'
    },
    {
      label: 'Watch later',
      section: 'watch-later',
      icon: 'clock'
    },
    {
      label: 'Liked videos',
      section: 'liked',
      icon: 'heart'
    },
    {
      label: 'Playlists',
      section: 'playlists',
      icon: 'playlist'
    }
  ];

  closeMenu(): void {
    this.ui.closeMobileMenu();
  }
}
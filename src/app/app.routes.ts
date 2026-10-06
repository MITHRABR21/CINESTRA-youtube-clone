import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'CINESTRA | Your screen. Your choice.',
    loadComponent: () =>
      import('./pages/home/home').then(m => m.Home)
  },
  {
    path: 'search',
    title: 'Search | CINESTRA',
    loadComponent: () =>
      import('./pages/search/search').then(m => m.Search)
  },
  {
    path: 'watch/:id',
    title: 'Watch | CINESTRA',
    loadComponent: () =>
      import('./pages/watch/watch').then(m => m.Watch)
  },
  {
    path: 'shorts',
    title: 'Shorts | CINESTRA',
    loadComponent: () =>
      import('./pages/shorts/shorts').then(m => m.Shorts)
  },
  {
    path: 'channel/:id',
    title: 'Channel | CINESTRA',
    loadComponent: () =>
      import('./pages/channel/channel').then(m => m.Channel)
  },
  {
    path: 'library',
    title: 'Library | CINESTRA',
    loadComponent: () =>
      import('./pages/library/library').then(m => m.Library)
  },
  {
    path: 'playlist/:id',
    title: 'Playlist | CINESTRA',
    loadComponent: () =>
      import('./pages/playlist/playlist').then(m => m.Playlist)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
import {
  Component,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { Video } from '../../core/models/video.model';
import { Playlist } from '../../core/models/playlist.model';
import { LibraryService } from '../../core/services/library';
import { VideoCard } from '../../shared/video-card/video-card';

type LibrarySection = 'history' | 'watch-later' | 'liked' | 'playlists';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [RouterLink, VideoCard],
  templateUrl: './library.html',
  styleUrl: './library.css'
})
export class Library implements OnDestroy {
  readonly library = inject(LibraryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly section = signal<LibrarySection>('history');

  readonly tabs: Array<{
    id: LibrarySection;
    label: string;
  }> = [
    { id: 'history', label: 'History' },
    { id: 'watch-later', label: 'Watch later' },
    { id: 'liked', label: 'Liked videos' },
    { id: 'playlists', label: 'Playlists' }
  ];

  readonly currentVideos = computed<Video[]>(() => {
    switch (this.section()) {
      case 'history':
        return this.library.history();
      case 'watch-later':
        return this.library.watchLater();
      case 'liked':
        return this.library.likedVideos();
      default:
        return [];
    }
  });

  readonly sectionTitle = computed(() =>
    this.tabs.find(tab => tab.id === this.section())?.label ?? 'History'
  );

  readonly emptyMessage = computed(() => {
    switch (this.section()) {
      case 'history':
        return 'Videos you open will appear here.';
      case 'watch-later':
        return 'Save videos for later using the clock button.';
      case 'liked':
        return 'Like a video from its Watch page to find it here.';
      default:
        return 'Create a playlist to collect your favourite videos.';
    }
  });

  private readonly subscription: Subscription;

  constructor() {
    this.subscription = this.route.queryParamMap.subscribe(params => {
      const section = params.get('section');

      this.section.set(
        this.tabs.some(tab => tab.id === section)
          ? section as LibrarySection
          : 'history'
      );
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  selectSection(section: LibrarySection): void {
    void this.router.navigate(['/library'], {
      queryParams: { section }
    });
  }

  createPlaylist(): void {
    const name = window.prompt('Playlist name');

    if (!name?.trim()) {
      return;
    }

    const playlist = this.library.createPlaylist(name);

    if (playlist) {
      void this.router.navigate(['/playlist', playlist.id]);
    }
  }

  deletePlaylist(playlist: Playlist): void {
    if (window.confirm(`Delete "${playlist.name}"?`)) {
      this.library.deletePlaylist(playlist.id);
    }
  }

  clearHistory(): void {
    if (window.confirm('Clear your CINESTRA history?')) {
      this.library.clearHistory();
    }
  }

  removeVideo(video: Video): void {
    switch (this.section()) {
      case 'history':
        this.library.removeFromHistory(video.id);
        break;
      case 'watch-later':
        if (this.library.isInWatchLater(video.id)) {
          this.library.toggleWatchLater(video);
        }
        break;
      case 'liked':
        if (this.library.isLiked(video.id)) {
          this.library.toggleLike(video);
        }
        break;
    }
  }
}
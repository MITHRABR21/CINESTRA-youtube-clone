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
import { LibraryService } from '../../core/services/library';
import { VideoCard } from '../../shared/video-card/video-card';

@Component({
  selector: 'app-playlist',
  standalone: true,
  imports: [RouterLink, VideoCard],
  templateUrl: './playlist.html',
  styleUrl: './playlist.css'
})
export class Playlist {
  readonly library = inject(LibraryService);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly playlistId = signal('');

  readonly playlist = computed(() =>
    this.library.getPlaylist(this.playlistId())
  );

  readonly totalDuration = computed(() => {
    const videos = this.playlist()?.videos ?? [];

    const seconds = videos.reduce(
      (total, video) => total + (video.durationSeconds ?? 0),
      0
    );

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours) {
      return `${hours} hr ${minutes} min`;
    }

    return seconds > 0
      ? `${Math.max(1, minutes)} min`
      : '';
  });

  private readonly subscription: Subscription;

  constructor() {
    this.subscription = this.route.paramMap.subscribe(params => {
      this.playlistId.set(params.get('id') ?? '');
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  renamePlaylist(): void {
    const playlist = this.playlist();

    if (!playlist) {
      return;
    }

    const name = window.prompt('Playlist name', playlist.name);

    if (name?.trim()) {
      this.library.renamePlaylist(playlist.id, name);
    }
  }

  deletePlaylist(): void {
    const playlist = this.playlist();

    if (!playlist) {
      return;
    }

    if (window.confirm(`Delete "${playlist.name}"?`)) {
      this.library.deletePlaylist(playlist.id);

      void this.router.navigate(['/library'], {
        queryParams: { section: 'playlists' }
      });
    }
  }

  removeVideo(video: Video): void {
    this.library.removeFromPlaylist(this.playlistId(), video.id);
  }

  playFirst(): void {
    const first = this.playlist()?.videos[0];

    if (first) {
      void this.router.navigate(['/watch', first.youtubeId]);
    }
  }

  formatDate(value: string): string {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
  }
}
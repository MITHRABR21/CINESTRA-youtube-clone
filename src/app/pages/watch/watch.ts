import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  DomSanitizer,
  SafeResourceUrl
} from '@angular/platform-browser';
import { Subscription } from 'rxjs';

import { Video } from '../../core/models/video.model';
import { VideoService } from '../../core/services/video';
import { LibraryService } from '../../core/services/library';
import { VideoCard } from '../../shared/video-card/video-card';

@Component({
  selector: 'app-watch',
  standalone: true,
  imports: [RouterLink, VideoCard],
  templateUrl: './watch.html',
  styleUrl: './watch.css'
})
export class Watch implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly videoService = inject(VideoService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly library = inject(LibraryService);

  readonly video = signal<Video | null>(null);
  readonly playerUrl = signal<SafeResourceUrl | null>(null);
  readonly recommendations = signal<Video[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal('');
  readonly descriptionExpanded = signal(false);
  readonly playlistMenuOpen = signal(false);
  readonly notice = signal('');

  private readonly subscription: Subscription;
  private requestId = 0;
  private destroyed = false;

  constructor() {
    this.subscription = this.route.paramMap.subscribe(params => {
      void this.loadVideo(params.get('id') ?? '');
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.requestId++;
    this.subscription.unsubscribe();
  }

  async loadVideo(id: string): Promise<void> {
    if (this.destroyed) {
      return;
    }

    const requestId = ++this.requestId;

    this.video.set(null);
    this.playerUrl.set(null);
    this.recommendations.set([]);
    this.error.set('');
    this.notice.set('');
    this.descriptionExpanded.set(false);
    this.playlistMenuOpen.set(false);

    if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
      this.error.set('This video link is invalid.');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    window.scrollTo({ top: 0, behavior: 'instant' });

    try {
      const video = await this.videoService.getVideo(id);

      if (!this.isActive(requestId)) {
        return;
      }

      if (!video) {
        this.error.set(
          'This video is unavailable or cannot be embedded.'
        );
        return;
      }

      this.video.set(video);

      this.playerUrl.set(
        this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.youtube.com/embed/${id}?playsinline=1`
        )
      );

      this.library.recordWatch(video);
      void this.loadRecommendations(id, requestId);
    } catch (error) {
      if (this.isActive(requestId)) {
        this.error.set(
          error instanceof Error
            ? error.message
            : 'Could not load this video.'
        );
      }
    } finally {
      if (this.isActive(requestId)) {
        this.isLoading.set(false);
      }
    }
  }

  retry(): void {
    void this.loadVideo(
      this.route.snapshot.paramMap.get('id') ?? ''
    );
  }

  toggleLike(): void {
    const video = this.video();

    if (video) {
      this.library.toggleLike(video);
    }
  }

  toggleWatchLater(): void {
    const video = this.video();

    if (video) {
      this.library.toggleWatchLater(video);
    }
  }

  toggleDescription(): void {
    this.descriptionExpanded.update(expanded => !expanded);
  }

  togglePlaylistMenu(): void {
    this.playlistMenuOpen.update(open => !open);
    this.notice.set('');
  }

  addToPlaylist(playlistId: string): void {
    const video = this.video();

    if (!video) {
      return;
    }

    this.library.addToPlaylist(playlistId, video);
    this.notice.set('Saved to playlist.');
    this.playlistMenuOpen.set(false);
  }

  createPlaylist(): void {
    const video = this.video();

    if (!video) {
      return;
    }

    const name = window.prompt('Playlist name');

    if (!name?.trim()) {
      return;
    }

    const playlist = this.library.createPlaylist(name);

    if (playlist) {
      this.library.addToPlaylist(playlist.id, video);
      this.notice.set(`Saved to "${playlist.name}".`);
      this.playlistMenuOpen.set(false);
    }
  }

  formatViews(count: number | null): string {
    return count === null
      ? 'Views unavailable'
      : `${new Intl.NumberFormat('en-IN').format(count)} views`;
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

  channelInitial(): string {
    return this.video()?.channelName.trim().charAt(0).toUpperCase() || 'C';
  }

  private async loadRecommendations(
    videoId: string,
    requestId: number
  ): Promise<void> {
    try {
      const page = await this.videoService.getHomeVideos();

      if (this.isActive(requestId)) {
        this.recommendations.set(
          page.videos
            .filter(video => video.id !== videoId)
            .slice(0, 12)
        );
      }
    } catch {
      // Playback remains available if recommendations fail.
    }
  }

  private isActive(requestId: number): boolean {
    return !this.destroyed && requestId === this.requestId;
  }
}
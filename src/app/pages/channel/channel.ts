import {
  Component,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

import { Video } from '../../core/models/video.model';
import { VideoService } from '../../core/services/video';
import { VideoCard } from '../../shared/video-card/video-card';

@Component({
  selector: 'app-channel',
  standalone: true,
  imports: [VideoCard],
  templateUrl: './channel.html',
  styleUrl: './channel.css'
})
export class Channel implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly videoService = inject(VideoService);

  readonly channelId = signal('');
  readonly videos = signal<Video[]>([]);
  readonly isLoading = signal(false);
  readonly isLoadingMore = signal(false);
  readonly error = signal('');
  readonly nextPageToken = signal<string | null>(null);

  readonly channelName = computed(() =>
    this.videos()[0]?.channelName || 'YouTube channel'
  );

  readonly channelAvatar = computed(() =>
    this.videos().find(video => !!video.channelAvatarUrl)
      ?.channelAvatarUrl || ''
  );

  readonly channelInitial = computed(() =>
    this.channelName().trim().charAt(0).toUpperCase() || 'C'
  );

  readonly youtubeUrl = computed(() =>
    `https://www.youtube.com/channel/${encodeURIComponent(this.channelId())}`
  );

  private readonly subscription: Subscription;
  private requestId = 0;
  private destroyed = false;

  constructor() {
    this.subscription = this.route.paramMap.subscribe(params => {
      this.channelId.set(params.get('id') ?? '');
      void this.loadVideos();
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.requestId++;
    this.subscription.unsubscribe();
  }

  async loadVideos(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    const requestId = ++this.requestId;
    const channelId = this.channelId();

    this.videos.set([]);
    this.error.set('');
    this.nextPageToken.set(null);
    this.isLoadingMore.set(false);
    this.isLoading.set(false);

    if (!/^UC[a-zA-Z0-9_-]{22}$/.test(channelId)) {
      this.error.set('This channel link is invalid.');
      return;
    }

    this.isLoading.set(true);

    try {
      const page = await this.videoService.getChannelVideos(channelId);

      if (this.isActive(requestId)) {
        this.videos.set(page.videos);
        this.nextPageToken.set(page.nextPageToken);
      }
    } catch (error) {
      if (this.isActive(requestId)) {
        this.error.set(this.errorMessage(error));
      }
    } finally {
      if (this.isActive(requestId)) {
        this.isLoading.set(false);
      }
    }
  }

  async loadMore(): Promise<void> {
    const token = this.nextPageToken();

    if (
      this.destroyed ||
      !token ||
      this.isLoading() ||
      this.isLoadingMore()
    ) {
      return;
    }

    const requestId = this.requestId;
    const channelId = this.channelId();

    this.isLoadingMore.set(true);
    this.error.set('');

    try {
      const page = await this.videoService.getChannelVideos(
        channelId,
        token
      );

      if (!this.isActive(requestId)) {
        return;
      }

      this.videos.update(current => {
        const byId = new Map(current.map(video => [video.id, video]));

        for (const video of page.videos) {
          byId.set(video.id, video);
        }

        return [...byId.values()];
      });

      this.nextPageToken.set(page.nextPageToken);
    } catch (error) {
      if (this.isActive(requestId)) {
        this.error.set(this.errorMessage(error));
      }
    } finally {
      if (this.isActive(requestId)) {
        this.isLoadingMore.set(false);
      }
    }
  }

  retry(): void {
    if (this.videos().length && this.nextPageToken()) {
      void this.loadMore();
    } else {
      void this.loadVideos();
    }
  }

  private isActive(requestId: number): boolean {
    return !this.destroyed && requestId === this.requestId;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message
      : 'Could not load channel videos. Please try again.';
  }
}
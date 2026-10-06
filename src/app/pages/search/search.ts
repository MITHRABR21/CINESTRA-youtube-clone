import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

import { Video } from '../../core/models/video.model';
import { VideoService } from '../../core/services/video';
import { VideoCard } from '../../shared/video-card/video-card';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [VideoCard],
  templateUrl: './search.html',
  styleUrl: './search.css'
})
export class Search implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly videoService = inject(VideoService);

  readonly query = signal('');
  readonly videos = signal<Video[]>([]);
  readonly isLoading = signal(false);
  readonly isLoadingMore = signal(false);
  readonly error = signal('');
  readonly nextPageToken = signal<string | null>(null);

  private readonly subscription: Subscription;
  private requestId = 0;
  private destroyed = false;

  constructor() {
    this.subscription = this.route.queryParamMap.subscribe(params => {
      this.query.set((params.get('q') ?? '').trim());
      void this.search();
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.requestId++;
    this.subscription.unsubscribe();
  }

  async search(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    const requestId = ++this.requestId;
    const query = this.query();

    this.videos.set([]);
    this.error.set('');
    this.nextPageToken.set(null);
    this.isLoadingMore.set(false);
    this.isLoading.set(!!query);

    if (!query) {
      return;
    }

    try {
      const page = await this.videoService.searchVideos(query);

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
    const query = this.query();

    this.isLoadingMore.set(true);
    this.error.set('');

    try {
      const page = await this.videoService.searchVideos(query, token);

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
      void this.search();
    }
  }

  private isActive(requestId: number): boolean {
    return !this.destroyed && requestId === this.requestId;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message
      : 'Could not load search results. Please try again.';
  }
}
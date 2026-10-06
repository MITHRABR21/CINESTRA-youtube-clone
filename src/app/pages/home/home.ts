import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal
} from '@angular/core';

import { Video } from '../../core/models/video.model';
import { VideoService } from '../../core/services/video';
import { VideoCard } from '../../shared/video-card/video-card';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [VideoCard],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit, OnDestroy {
  readonly videoService = inject(VideoService);

  readonly videos = signal<Video[]>([]);
  readonly selectedCategory = signal('All');
  readonly isLoading = signal(false);
  readonly isLoadingMore = signal(false);
  readonly error = signal('');
  readonly nextPageToken = signal<string | null>(null);

  readonly skeletons = Array.from({ length: 12 }, (_, index) => index);

  private requestId = 0;
  private destroyed = false;

  ngOnInit(): void {
    void this.loadVideos();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.requestId++;
  }

  selectCategory(category: string): void {
    if (category === this.selectedCategory()) {
      return;
    }

    this.selectedCategory.set(category);
    void this.loadVideos();
  }

  async loadVideos(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    const requestId = ++this.requestId;
    const category = this.selectedCategory();

    this.isLoading.set(true);
    this.isLoadingMore.set(false);
    this.error.set('');
    this.videos.set([]);
    this.nextPageToken.set(null);

    try {
      const page = await this.videoService.getHomeVideos(category);

      if (!this.isActive(requestId)) {
        return;
      }

      this.videos.set(page.videos);
      this.nextPageToken.set(page.nextPageToken);
    } catch (error) {
      if (this.isActive(requestId)) {
        this.error.set(
          error instanceof Error
            ? error.message
            : 'Could not load videos. Please try again.'
        );
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
    const category = this.selectedCategory();

    this.isLoadingMore.set(true);
    this.error.set('');

    try {
      const page = await this.videoService.getHomeVideos(
        category,
        token
      );

      if (!this.isActive(requestId)) {
        return;
      }

      this.videos.update(current => {
        const byId = new Map(
          current.map(video => [video.id, video])
        );

        for (const video of page.videos) {
          byId.set(video.id, video);
        }

        return [...byId.values()];
      });

      this.nextPageToken.set(page.nextPageToken);
    } catch (error) {
      if (this.isActive(requestId)) {
        this.error.set(
          error instanceof Error
            ? error.message
            : 'Could not load more videos. Please try again.'
        );
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
}
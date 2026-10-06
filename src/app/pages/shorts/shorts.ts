import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  DomSanitizer,
  SafeResourceUrl
} from '@angular/platform-browser';

import { Video } from '../../core/models/video.model';
import { VideoService } from '../../core/services/video';
import { LibraryService } from '../../core/services/library';

@Component({
  selector: 'app-shorts',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './shorts.html',
  styleUrl: './shorts.css'
})
export class Shorts implements OnInit, OnDestroy {
  private readonly videoService = inject(VideoService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly library = inject(LibraryService);

  readonly videos = signal<Video[]>([]);
  readonly currentIndex = signal(0);
  readonly isLoading = signal(false);
  readonly isLoadingMore = signal(false);
  readonly error = signal('');
  readonly nextPageToken = signal<string | null>(null);

  readonly currentVideo = computed(
    () => this.videos()[this.currentIndex()] ?? null
  );

  readonly playerUrl = computed<SafeResourceUrl | null>(() => {
    const video = this.currentVideo();

    if (!video || !/^[a-zA-Z0-9_-]{11}$/.test(video.youtubeId)) {
      return null;
    }

    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${video.youtubeId}?playsinline=1`
    );
  });

  readonly canGoPrevious = computed(() => this.currentIndex() > 0);

  readonly canGoNext = computed(() =>
    this.currentIndex() < this.videos().length - 1 ||
    !!this.nextPageToken()
  );

  private destroyed = false;
  private requestId = 0;

  ngOnInit(): void {
    void this.loadShorts();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.requestId++;
  }

  async loadShorts(): Promise<void> {
    if (this.destroyed) {
      return;
    }

    const requestId = ++this.requestId;

    this.isLoading.set(true);
    this.isLoadingMore.set(false);
    this.error.set('');
    this.videos.set([]);
    this.currentIndex.set(0);
    this.nextPageToken.set(null);

    try {
      const page = await this.videoService.getShortVideos();

      if (this.isActive(requestId)) {
        this.videos.set(page.videos);
        this.nextPageToken.set(page.nextPageToken);
        this.recordCurrent();
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

  previous(): void {
    if (this.canGoPrevious()) {
      this.currentIndex.update(index => index - 1);
      this.recordCurrent();
    }
  }

  async next(): Promise<void> {
    if (this.currentIndex() < this.videos().length - 1) {
      this.currentIndex.update(index => index + 1);
      this.recordCurrent();
      return;
    }

    await this.loadMore(true);
  }

  async loadMore(advance = false): Promise<void> {
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
    const previousLength = this.videos().length;
    const previousIndex = this.currentIndex();

    this.isLoadingMore.set(true);
    this.error.set('');

    try {
      const page = await this.videoService.getShortVideos('#shorts', token);

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

      if (
        advance &&
        this.currentIndex() === previousIndex &&
        this.videos().length > previousLength
      ) {
        this.currentIndex.set(previousLength);
      }

      this.recordCurrent();
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
    if (this.nextPageToken()) {
      void this.loadMore(!!this.currentVideo());
    } else {
      void this.loadShorts();
    }
  }

  toggleLike(): void {
    const video = this.currentVideo();

    if (video) {
      this.library.toggleLike(video);
    }
  }

  toggleWatchLater(): void {
    const video = this.currentVideo();

    if (video) {
      this.library.toggleWatchLater(video);
    }
  }

  private recordCurrent(): void {
    const video = this.currentVideo();

    if (video) {
      this.library.recordWatch(video);
    }
  }

  private isActive(requestId: number): boolean {
    return !this.destroyed && requestId === this.requestId;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message
      : 'Could not load short videos. Please try again.';
  }
}
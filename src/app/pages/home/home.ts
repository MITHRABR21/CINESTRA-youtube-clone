import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
  signal
} from '@angular/core';

import { RouterLink } from '@angular/router';
import { Video } from '../../core/models/video.model';
import { VideoService } from '../../core/services/video';
import { VideoCard } from '../../shared/video-card/video-card';

type DiscoverySection = 'tamil' | 'english' | 'shorts';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [VideoCard, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit, OnDestroy {
  readonly videoService = inject(VideoService);

  readonly categories = [
    'All',
    'Music',
    'Movies',
    'Gaming',
    'Technology',
    'Education',
    'Sports',
    'Comedy',
    'Travel'
  ];

  readonly videos = signal<Video[]>([]);
  readonly selectedCategory = signal('All');
  readonly isLoading = signal(false);
  readonly isLoadingMore = signal(false);
  readonly error = signal('');
  readonly nextPageToken = signal<string | null>(null);

  readonly tamilSongs = signal<Video[]>([]);
  readonly englishSongs = signal<Video[]>([]);
  readonly shorts = signal<Video[]>([]);

  readonly tamilSongsLoading = signal(false);
  readonly englishSongsLoading = signal(false);
  readonly shortsLoading = signal(false);

  readonly tamilSongsError = signal('');
  readonly englishSongsError = signal('');
  readonly shortsError = signal('');

  readonly skeletons = Array.from(
    { length: 12 },
    (_, index) => index
  );

  private readonly categoryQueries: Record<string, string> = {
    All: 'Tamil entertainment latest videos',
    Music: 'Tamil songs official music video',
    Movies: 'Tamil movie official trailer',
    Gaming: 'Tamil gaming',
    Technology: 'Tamil tech review',
    Education: 'Tamil educational videos',
    Sports: 'Tamil sports cricket',
    Comedy: 'Tamil comedy',
    Travel: 'Tamil travel vlog'
  };

  private requestId = 0;
  private destroyed = false;
  private scrollFrame: number | null = null;

  ngOnInit(): void {
    void this.loadVideos();
    void this.loadSection('tamil');
    void this.loadSection('english');
    void this.loadSection('shorts');
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.requestId++;

    if (this.scrollFrame !== null) {
      cancelAnimationFrame(this.scrollFrame);
    }
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (this.destroyed || this.scrollFrame !== null) {
      return;
    }

    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = null;

      if (
        this.destroyed ||
        this.isLoading() ||
        this.isLoadingMore() ||
        this.error() ||
        !this.nextPageToken()
      ) {
        return;
      }

      const remaining =
        document.documentElement.scrollHeight -
        window.innerHeight -
        window.scrollY;

      if (remaining <= 600) {
        void this.loadMore();
      }
    });
  }

  selectCategory(category: string): void {
    if (
      !this.categories.includes(category) ||
      category === this.selectedCategory()
    ) {
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

    this.isLoading.set(true);
    this.isLoadingMore.set(false);
    this.error.set('');
    this.videos.set([]);
    this.nextPageToken.set(null);

    try {
      const page = await this.videoService.searchVideos(
        this.getFeedQuery()
      );

      if (!this.isActive(requestId)) {
        return;
      }

      this.videos.set(this.uniqueVideos(page.videos));
      this.nextPageToken.set(page.nextPageToken);
    } catch (error) {
      if (this.isActive(requestId)) {
        this.error.set(
          this.getErrorMessage(error, 'Could not load videos.')
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
    const query = this.getFeedQuery();

    this.isLoadingMore.set(true);
    this.error.set('');

    try {
      const page = await this.videoService.searchVideos(
        query,
        token
      );

      if (!this.isActive(requestId)) {
        return;
      }

      this.videos.update(current =>
        this.uniqueVideos([...current, ...page.videos])
      );

      this.nextPageToken.set(
        page.nextPageToken === token
          ? null
          : page.nextPageToken
      );
    } catch (error) {
      if (this.isActive(requestId)) {
        this.error.set(
          this.getErrorMessage(
            error,
            'Could not load more videos. Please try again.'
          )
        );
      }
    } finally {
      if (this.isActive(requestId)) {
        this.isLoadingMore.set(false);
      }
    }
  }

  retry(): void {
    if (this.nextPageToken() && !this.isLoading()) {
      void this.loadMore();
    } else {
      void this.loadVideos();
    }
  }

  async loadSection(section: DiscoverySection): Promise<void> {
    const loading = this.getSectionLoading(section);
    const sectionError = this.getSectionError(section);
    const sectionVideos = this.getSectionVideos(section);

    if (this.destroyed || loading()) {
      return;
    }

    loading.set(true);
    sectionError.set('');

    try {
      const page = section === 'shorts'
        ? await this.videoService.getShortVideos('Tamil #shorts')
        : await this.videoService.searchVideos(
            section === 'tamil'
              ? 'Tamil songs Anirudh AR Rahman official'
              : 'English pop songs official music video'
          );

      if (this.destroyed) {
        return;
      }

      let videos = this.uniqueVideos(page.videos);

      if (
        section === 'shorts' &&
        videos.length === 0 &&
        page.nextPageToken
      ) {
        const nextPage = await this.videoService.getShortVideos(
          'Tamil #shorts',
          page.nextPageToken
        );

        if (this.destroyed) {
          return;
        }

        videos = this.uniqueVideos(nextPage.videos);
      }

      sectionVideos.set(
        videos.slice(0, section === 'shorts' ? 8 : 6)
      );
    } catch (error) {
      if (!this.destroyed) {
        sectionError.set(
          this.getErrorMessage(
            error,
            'Could not load this section. Please try again.'
          )
        );
      }
    } finally {
      if (!this.destroyed) {
        loading.set(false);
      }
    }
  }

  formatViews(viewCount: number | null): string {
    if (viewCount === null) {
      return '';
    }

    return `${new Intl.NumberFormat('en', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(viewCount)} views`;
  }

  private getFeedQuery(): string {
    return this.categoryQueries[this.selectedCategory()]
      ?? this.categoryQueries['All'];
  }

  private getSectionLoading(section: DiscoverySection) {
    switch (section) {
      case 'tamil':
        return this.tamilSongsLoading;
      case 'english':
        return this.englishSongsLoading;
      case 'shorts':
        return this.shortsLoading;
    }
  }

  private getSectionError(section: DiscoverySection) {
    switch (section) {
      case 'tamil':
        return this.tamilSongsError;
      case 'english':
        return this.englishSongsError;
      case 'shorts':
        return this.shortsError;
    }
  }

  private getSectionVideos(section: DiscoverySection) {
    switch (section) {
      case 'tamil':
        return this.tamilSongs;
      case 'english':
        return this.englishSongs;
      case 'shorts':
        return this.shorts;
    }
  }

  private uniqueVideos(videos: Video[]): Video[] {
    return [...new Map(
      videos.map(video => [video.id, video])
    ).values()];
  }

  private getErrorMessage(
    error: unknown,
    fallback: string
  ): string {
    return error instanceof Error ? error.message : fallback;
  }

  private isActive(requestId: number): boolean {
    return !this.destroyed && requestId === this.requestId;
  }
}
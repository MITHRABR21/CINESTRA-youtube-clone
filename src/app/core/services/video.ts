import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpParams
} from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { Video } from '../models/video.model';

interface Thumbnail {
  url: string;
}

interface Snippet {
  title: string;
  description?: string;
  channelId?: string;
  channelTitle?: string;
  publishedAt?: string;
  categoryId?: string;
  defaultAudioLanguage?: string;
  defaultLanguage?: string;
  thumbnails?: {
    maxres?: Thumbnail;
    standard?: Thumbnail;
    high?: Thumbnail;
    medium?: Thumbnail;
    default?: Thumbnail;
  };
}

interface ApiVideo {
  id: string;
  snippet: Snippet;
  contentDetails?: {
    duration?: string;
  };
  statistics?: {
    viewCount?: string;
  };
  status?: {
    embeddable?: boolean;
  };
}

interface ApiChannel {
  id: string;
  snippet: Snippet;
}

interface SearchItem {
  id: {
    videoId?: string;
  };
}

interface ApiList<T> {
  items?: T[];
  nextPageToken?: string;
}

export interface VideoPage {
  videos: Video[];
  nextPageToken: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://www.googleapis.com/youtube/v3';
  private readonly cacheDuration = 10 * 60 * 1000;

  private keyRequest: Promise<string> | null = null;

  private readonly cache = new Map<
    string,
    { expiresAt: number; value: unknown }
  >();

  private readonly pending = new Map<string, Promise<unknown>>();

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

  private readonly categoryIds: Record<string, string> = {
    Music: '10',
    Movies: '1',
    Gaming: '20',
    Technology: '28',
    Education: '27',
    Sports: '17',
    Comedy: '23',
    Travel: '19'
  };

  async getHomeVideos(
    category = 'All',
    pageToken = ''
  ): Promise<VideoPage> {
    const params: Record<string, string> = {
      part: 'snippet,contentDetails,statistics,status',
      chart: 'mostPopular',
      regionCode: 'IN',
      maxResults: '24'
    };

    const categoryId = this.categoryIds[category];

    if (categoryId) {
      params['videoCategoryId'] = categoryId;
    }

    if (pageToken) {
      params['pageToken'] = pageToken;
    }

    const response = await this.request<ApiList<ApiVideo>>(
      'videos',
      params
    );

    return {
      videos: await this.convertVideos(response.items ?? []),
      nextPageToken: response.nextPageToken ?? null
    };
  }

  async searchVideos(
    query: string,
    pageToken = ''
  ): Promise<VideoPage> {
    const cleanQuery = query.trim();

    if (!cleanQuery) {
      return { videos: [], nextPageToken: null };
    }

    return this.searchPage({
      q: cleanQuery,
      order: 'relevance',
      ...(pageToken ? { pageToken } : {})
    });
  }

  async getChannelVideos(
    channelId: string,
    pageToken = ''
  ): Promise<VideoPage> {
    if (!channelId.trim()) {
      return { videos: [], nextPageToken: null };
    }

    return this.searchPage({
      channelId: channelId.trim(),
      order: 'date',
      ...(pageToken ? { pageToken } : {})
    });
  }

  async getShortVideos(
    query = '#shorts',
    pageToken = ''
  ): Promise<VideoPage> {
    const page = await this.searchPage({
      q: query.trim() || '#shorts',
      videoDuration: 'short',
      order: 'relevance',
      ...(pageToken ? { pageToken } : {})
    });

    return {
      videos: page.videos.filter(video =>
        video.durationSeconds !== null &&
        video.durationSeconds > 0 &&
        video.durationSeconds <= 180 &&
        /#shorts\b/i.test(`${video.title} ${video.description}`)
      ),
      nextPageToken: page.nextPageToken
    };
  }

  async getVideo(videoId: string): Promise<Video | null> {
    if (!videoId.trim()) {
      return null;
    }

    const videos = await this.getVideosByIds([videoId.trim()]);
    return videos[0] ?? null;
  }

  private async searchPage(
    filters: Record<string, string>
  ): Promise<VideoPage> {
    const response = await this.request<ApiList<SearchItem>>(
      'search',
      {
        part: 'snippet',
        type: 'video',
        maxResults: '24',
        regionCode: 'IN',
        videoEmbeddable: 'true',
        videoSyndicated: 'true',
        ...filters
      }
    );

    const ids = (response.items ?? [])
      .map(item => item.id.videoId)
      .filter((id): id is string => !!id);

    return {
      videos: await this.getVideosByIds(ids),
      nextPageToken: response.nextPageToken ?? null
    };
  }

  private async getVideosByIds(ids: string[]): Promise<Video[]> {
    const uniqueIds = [...new Set(ids)].slice(0, 50);

    if (!uniqueIds.length) {
      return [];
    }

    const response = await this.request<ApiList<ApiVideo>>(
      'videos',
      {
        part: 'snippet,contentDetails,statistics,status',
        id: uniqueIds.join(',')
      }
    );

    const videos = await this.convertVideos(response.items ?? []);
    const byId = new Map(videos.map(video => [video.id, video]));

    return uniqueIds
      .map(id => byId.get(id))
      .filter((video): video is Video => !!video);
  }

  private async convertVideos(items: ApiVideo[]): Promise<Video[]> {
    const embeddable = items.filter(
      item => item.status?.embeddable === true
    );

    const channelIds = [
      ...new Set(
        embeddable
          .map(item => item.snippet.channelId)
          .filter((id): id is string => !!id)
      )
    ];

    const avatars = new Map<string, string>();

    if (channelIds.length) {
      try {
        const channels = await this.request<ApiList<ApiChannel>>(
          'channels',
          {
            part: 'snippet',
            id: channelIds.join(',')
          }
        );

        for (const channel of channels.items ?? []) {
          avatars.set(
            channel.id,
            this.getThumbnail(channel.snippet)
          );
        }
      } catch {
        // Video results remain usable without channel avatars.
      }
    }

    return embeddable.map(item => {
      const snippet = item.snippet;
      const duration = this.parseDuration(item.contentDetails?.duration);
      const title = this.decodeText(snippet.title);
      const description = snippet.description ?? '';
      const channelId = snippet.channelId ?? '';

      return {
        id: item.id,
        youtubeId: item.id,
        title,
        description,
        thumbnailUrl: this.getThumbnail(snippet),
        channelId,
        channelName: this.decodeText(snippet.channelTitle ?? ''),
        channelAvatarUrl: avatars.get(channelId) ?? '',
        publishedAt: snippet.publishedAt ?? '',
        durationSeconds: duration,
        viewCount: this.parseNumber(item.statistics?.viewCount),
        category: this.getCategory(snippet.categoryId),
        language:
          snippet.defaultAudioLanguage ??
          snippet.defaultLanguage ??
          'Unknown',
        isShort:
          duration !== null &&
          duration > 0 &&
          duration <= 180 &&
          /#shorts\b/i.test(`${title} ${description}`)
      };
    });
  }

  private async request<T>(
    endpoint: string,
    values: Record<string, string>
  ): Promise<T> {
    const cacheKey = `${endpoint}:${JSON.stringify(
      Object.entries(values).sort(([a], [b]) => a.localeCompare(b))
    )}`;

    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const existing = this.pending.get(cacheKey);

    if (existing) {
      return existing as Promise<T>;
    }

    const task = (async (): Promise<T> => {
      try {
        const key = await this.getApiKey();

        const params = new HttpParams({
          fromObject: { ...values, key }
        });

        const response = await firstValueFrom(
          this.http.get<T>(`${this.apiUrl}/${endpoint}`, {
            params
          }).pipe(timeout(15000))
        );

        if (this.cache.size >= 100) {
          this.cache.clear();
        }

        this.cache.set(cacheKey, {
          expiresAt: Date.now() + this.cacheDuration,
          value: response
        });

        return response;
      } catch (error) {
        throw new Error(this.getErrorMessage(error));
      }
    })();

    this.pending.set(cacheKey, task);

    try {
      return await task;
    } finally {
      this.pending.delete(cacheKey);
    }
  }

  private getApiKey(): Promise<string> {
    if (!this.keyRequest) {
      this.keyRequest = firstValueFrom(
        this.http.get<{ apiKey?: string }>(
          new URL('youtube-config.json', document.baseURI).href
        ).pipe(timeout(10000))
      )
        .then(config => {
          const key = config.apiKey?.trim();

          if (!key || key === 'PASTE_YOUR_API_KEY_HERE') {
            throw new Error(
              'Add your API key to public/youtube-config.json.'
            );
          }

          return key;
        })
        .catch(() => {
          this.keyRequest = null;

          throw new Error(
            'Could not load the API key. Check public/youtube-config.json.'
          );
        });
    }

    return this.keyRequest;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const reason = error.error?.error?.errors?.[0]?.reason;

      if (
        reason === 'quotaExceeded' ||
        reason === 'dailyLimitExceeded'
      ) {
        return 'YouTube API quota has been reached. Please try again later.';
      }

      if (error.status === 400) {
        return 'YouTube rejected the request. Check the API key and request settings.';
      }

      if (error.status === 403) {
        return 'YouTube access was denied. Check API enablement, key restrictions and quota.';
      }

      if (error.status === 0) {
        return 'Could not connect to YouTube. Check your internet connection.';
      }

      return 'Could not load videos from YouTube. Please try again.';
    }

    if (error instanceof Error && error.name === 'TimeoutError') {
      return 'YouTube took too long to respond. Please try again.';
    }

    return error instanceof Error
      ? error.message
      : 'Could not load videos. Please try again.';
  }

  private getThumbnail(snippet: Snippet): string {
    const thumbnails = snippet.thumbnails;

    return (
      thumbnails?.maxres?.url ??
      thumbnails?.standard?.url ??
      thumbnails?.high?.url ??
      thumbnails?.medium?.url ??
      thumbnails?.default?.url ??
      ''
    );
  }

  private parseDuration(value?: string): number | null {
    if (!value) {
      return null;
    }

    const match = value.match(
      /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/
    );

    if (!match) {
      return null;
    }

    return Math.floor(
      Number(match[1] ?? 0) * 86400 +
      Number(match[2] ?? 0) * 3600 +
      Number(match[3] ?? 0) * 60 +
      Number(match[4] ?? 0)
    );
  }

  private parseNumber(value?: string): number | null {
    if (value === undefined) {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number) && number >= 0
      ? number
      : null;
  }

  private getCategory(categoryId?: string): string {
    return Object.entries(this.categoryIds).find(
      ([, id]) => id === categoryId
    )?.[0] ?? 'Entertainment';
  }

  private decodeText(value: string): string {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }
}
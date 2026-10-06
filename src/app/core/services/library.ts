import { Injectable, signal } from '@angular/core';
import { Video } from '../models/video.model';
import { Playlist } from '../models/playlist.model';

interface LibraryState {
  likedVideos: Video[];
  watchLater: Video[];
  history: Video[];
  playlists: Playlist[];
}

@Injectable({
  providedIn: 'root'
})
export class LibraryService {
  private readonly storageKey = 'cinestra-library-v1';

  readonly likedVideos = signal<Video[]>([]);
  readonly watchLater = signal<Video[]>([]);
  readonly history = signal<Video[]>([]);
  readonly playlists = signal<Playlist[]>([]);

  constructor() {
    this.restore();
  }

  isLiked(videoId: string): boolean {
    return this.likedVideos().some(video => video.id === videoId);
  }

  toggleLike(video: Video): void {
    this.likedVideos.update(videos =>
      this.toggleVideo(videos, video)
    );
    this.save();
  }

  isInWatchLater(videoId: string): boolean {
    return this.watchLater().some(video => video.id === videoId);
  }

  toggleWatchLater(video: Video): void {
    this.watchLater.update(videos =>
      this.toggleVideo(videos, video)
    );
    this.save();
  }

  recordWatch(video: Video): void {
    this.history.update(videos =>
      [
        video,
        ...videos.filter(item => item.id !== video.id)
      ].slice(0, 200)
    );
    this.save();
  }

  removeFromHistory(videoId: string): void {
    this.history.update(videos =>
      videos.filter(video => video.id !== videoId)
    );
    this.save();
  }

  clearHistory(): void {
    this.history.set([]);
    this.save();
  }

  createPlaylist(
    name: string,
    description = ''
  ): Playlist | null {
    const cleanName = name.trim();

    if (!cleanName) {
      return null;
    }

    const now = new Date().toISOString();

    const playlist: Playlist = {
      id: crypto.randomUUID(),
      name: cleanName,
      description: description.trim(),
      videos: [],
      createdAt: now,
      updatedAt: now
    };

    this.playlists.update(playlists => [
      playlist,
      ...playlists
    ]);

    this.save();
    return playlist;
  }

  getPlaylist(playlistId: string): Playlist | undefined {
    return this.playlists().find(
      playlist => playlist.id === playlistId
    );
  }

  renamePlaylist(
    playlistId: string,
    name: string
  ): void {
    const cleanName = name.trim();

    if (!cleanName) {
      return;
    }

    this.playlists.update(playlists =>
      playlists.map(playlist =>
        playlist.id === playlistId
          ? {
              ...playlist,
              name: cleanName,
              updatedAt: new Date().toISOString()
            }
          : playlist
      )
    );

    this.save();
  }

  deletePlaylist(playlistId: string): void {
    this.playlists.update(playlists =>
      playlists.filter(
        playlist => playlist.id !== playlistId
      )
    );
    this.save();
  }

  isInPlaylist(
    playlistId: string,
    videoId: string
  ): boolean {
    return this.getPlaylist(playlistId)?.videos.some(
      video => video.id === videoId
    ) ?? false;
  }

  addToPlaylist(
    playlistId: string,
    video: Video
  ): void {
    this.playlists.update(playlists =>
      playlists.map(playlist => {
        if (
          playlist.id !== playlistId ||
          playlist.videos.some(item => item.id === video.id)
        ) {
          return playlist;
        }

        return {
          ...playlist,
          videos: [...playlist.videos, video],
          updatedAt: new Date().toISOString()
        };
      })
    );

    this.save();
  }

  removeFromPlaylist(
    playlistId: string,
    videoId: string
  ): void {
    this.playlists.update(playlists =>
      playlists.map(playlist =>
        playlist.id === playlistId
          ? {
              ...playlist,
              videos: playlist.videos.filter(
                video => video.id !== videoId
              ),
              updatedAt: new Date().toISOString()
            }
          : playlist
      )
    );

    this.save();
  }

  private toggleVideo(
    videos: Video[],
    video: Video
  ): Video[] {
    return videos.some(item => item.id === video.id)
      ? videos.filter(item => item.id !== video.id)
      : [video, ...videos];
  }

  private save(): void {
    const state: LibraryState = {
      likedVideos: this.likedVideos(),
      watchLater: this.watchLater(),
      history: this.history(),
      playlists: this.playlists()
    };

    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify(state)
      );
    } catch (error) {
      console.warn('CINESTRA library could not be saved:', error);
    }
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);

      if (!raw) {
        return;
      }

      const parsed: unknown = JSON.parse(raw);

      if (!this.isRecord(parsed)) {
        return;
      }

      this.likedVideos.set(this.readVideos(parsed['likedVideos']));
      this.watchLater.set(this.readVideos(parsed['watchLater']));
      this.history.set(
        this.readVideos(parsed['history']).slice(0, 200)
      );

      const playlists = parsed['playlists'];

      if (Array.isArray(playlists)) {
        this.playlists.set(
          playlists
            .filter(item => this.isPlaylist(item))
            .map(playlist => ({
              ...playlist,
              videos: this.readVideos(playlist.videos)
            }))
        );
      }
    } catch (error) {
      console.warn('CINESTRA library could not be loaded:', error);
    }
  }

  private readVideos(value: unknown): Video[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const seen = new Set<string>();

    return value.filter((item): item is Video => {
      if (!this.isVideo(item) || seen.has(item.id)) {
        return false;
      }

      seen.add(item.id);
      return true;
    });
  }

  private isRecord(
    value: unknown
  ): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private isVideo(value: unknown): value is Video {
    if (!this.isRecord(value)) {
      return false;
    }

    const stringFields = [
      'id',
      'youtubeId',
      'title',
      'description',
      'thumbnailUrl',
      'channelId',
      'channelName',
      'channelAvatarUrl',
      'publishedAt',
      'category',
      'language'
    ];

    return (
      stringFields.every(field => typeof value[field] === 'string') &&
      typeof value['isShort'] === 'boolean' &&
      this.isNullableNumber(value['durationSeconds']) &&
      this.isNullableNumber(value['viewCount'])
    );
  }

  private isNullableNumber(value: unknown): boolean {
    return value === null ||
      (typeof value === 'number' && Number.isFinite(value) && value >= 0);
  }

  private isPlaylist(value: unknown): value is Playlist {
    if (!this.isRecord(value)) {
      return false;
    }

    return (
      typeof value['id'] === 'string' &&
      typeof value['name'] === 'string' &&
      typeof value['description'] === 'string' &&
      typeof value['createdAt'] === 'string' &&
      typeof value['updatedAt'] === 'string' &&
      Array.isArray(value['videos'])
    );
  }
}
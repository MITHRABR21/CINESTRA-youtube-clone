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

  private readonly knownArtists = [
    'Kate Bush',
    'Anirudh Ravichander',
    'Anirudh',
    'A R Rahman',
    'AR Rahman',
    'Harris Jayaraj',
    'Yuvan Shankar Raja',
    'Ilaiyaraaja',
    'Dhibu Ninan Thomas',
    'Santhosh Narayanan',
    'G V Prakash',
    'Sid Sriram',
    'Arijit Singh',
    'Shreya Ghoshal',
    'Taylor Swift',
    'Ed Sheeran',
    'Ariana Grande',
    'Dua Lipa',
    'Charlie Puth',
    'Ava Max',
    'Billie Eilish',
    'Selena Gomez',
    'The Weeknd',
    'Bruno Mars',
    'Justin Bieber',
    'Coldplay',
    'BTS',
    'Blackpink'
  ];

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
      void this.loadRecommendations(video, requestId);
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
    this.descriptionExpanded.update(value => !value);
  }

  togglePlaylistMenu(): void {
    this.playlistMenuOpen.update(value => !value);
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
    current: Video,
    requestId: number
  ): Promise<void> {
    try {
      const artist = this.findArtist(current);

      const page = artist
        ? await this.videoService.searchVideos(
            `${artist} official songs`
          )
        : await this.videoService.getChannelVideos(current.channelId);

      if (!this.isActive(requestId)) {
        return;
      }

      let suggestions = this.filterSuggestions(
        page.videos,
        current,
        artist
      );

      // Try one more batch if repeated uploads filled the first page.
      if (suggestions.length < 6 && page.nextPageToken) {
        const nextPage = artist
          ? await this.videoService.searchVideos(
              `${artist} official songs`,
              page.nextPageToken
            )
          : await this.videoService.getChannelVideos(
              current.channelId,
              page.nextPageToken
            );

        if (!this.isActive(requestId)) {
          return;
        }

        suggestions = this.filterSuggestions(
          [...suggestions, ...nextPage.videos],
          current,
          artist
        );
      }

      this.recommendations.set(suggestions.slice(0, 12));
    } catch {
      // Playback remains available if suggestions cannot load.
    }
  }

  private findArtist(video: Video): string {
    const title = this.normalize(video.title);
    const channel = this.normalize(video.channelName);
    const description = this.normalize(
      video.description.slice(0, 2500)
    );

    // Prefer artists named in the title or their own channel.
    for (const source of [title, channel, description]) {
      const artist = this.knownArtists.find(name =>
        this.containsPhrase(source, this.normalize(name))
      );

      if (artist) {
        return artist;
      }
    }

    // Artist channels commonly use a VEVO or Official suffix.
    if (/\bvevo\b|vevo$|\bofficial\b/i.test(video.channelName)) {
      return video.channelName
        .replace(/vevo/gi, '')
        .replace(/\bofficial\b/gi, '')
        .trim();
    }

    return '';
  }

  private filterSuggestions(
    videos: Video[],
    current: Video,
    artist: string
  ): Video[] {
    const seenIds = new Set<string>();
    const seenSongs = new Set<string>();
    const artistText = this.normalize(artist);

    return videos.filter(candidate => {
      if (
        candidate.youtubeId === current.youtubeId ||
        seenIds.has(candidate.youtubeId) ||
        candidate.isShort
      ) {
        return false;
      }

      seenIds.add(candidate.youtubeId);

      if (artistText) {
        const text = this.normalize(
          `${candidate.title} ${candidate.channelName} ${
            candidate.description.slice(0, 1500)
          }`
        );

        if (!this.containsPhrase(text, artistText)) {
          return false;
        }
      }

      if (this.isSameSong(current, candidate)) {
        return false;
      }

      const songKey = this.songKey(candidate.title);

      if (songKey && seenSongs.has(songKey)) {
        return false;
      }

      if (songKey) {
        seenSongs.add(songKey);
      }

      return true;
    });
  }

  private isSameSong(current: Video, candidate: Video): boolean {
    const key = this.songKey(current.title);

    if (!key) {
      return false;
    }

    const candidateTitle = this.normalize(candidate.title);

    if (this.containsPhrase(candidateTitle, key)) {
      return true;
    }

    const words = key.split(' ').filter(word => word.length > 2);

    if (words.length < 2) {
      return false;
    }

    const candidateWords = new Set(candidateTitle.split(' '));
    const matches = words.filter(word => candidateWords.has(word));

    return matches.length / words.length >= 0.8;
  }

  private songKey(title: string): string {
    const sections = title.split(/[|｜]/).map(part => part.trim());

    // Handles titles such as "Kate Bush - Running Up That Hill".
    const artistSection = sections.find(section =>
      this.knownArtists.some(artist =>
        this.containsPhrase(
          this.normalize(section),
          this.normalize(artist)
        )
      ) && /\s[-–—]\s/.test(section)
    );

    let song = artistSection ?? sections[0] ?? title;
    const dashParts = song.split(/\s[-–—]\s/);

    if (dashParts.length > 1) {
      const first = this.normalize(dashParts[0]);
      const startsWithArtist = this.knownArtists.some(artist =>
        this.containsPhrase(first, this.normalize(artist))
      );

      song = startsWithArtist ? dashParts[1] : dashParts[0];
    }

    song = song
      .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
      .replace(
        /\b(?:official|full|video|audio|lyric|lyrics|song|songs|music|hd|uhd|4k|8k|remastered|remix|live|version)\b/gi,
        ' '
      );

    return this.normalize(song);
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private containsPhrase(text: string, phrase: string): boolean {
    return !!phrase && ` ${text} `.includes(` ${phrase} `);
  }

  private isActive(requestId: number): boolean {
    return !this.destroyed && requestId === this.requestId;
  }
}
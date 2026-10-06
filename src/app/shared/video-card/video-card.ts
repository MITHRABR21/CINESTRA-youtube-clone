import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Video } from '../../core/models/video.model';
import { LibraryService } from '../../core/services/library';

@Component({
  selector: 'app-video-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './video-card.html',
  styleUrl: './video-card.css'
})
export class VideoCard {
  readonly video = input.required<Video>();
  readonly library = inject(LibraryService);

  formatDuration(seconds: number | null): string {
    if (seconds === null) {
      return '';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const paddedSeconds = String(remainingSeconds).padStart(2, '0');

    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`
      : `${minutes}:${paddedSeconds}`;
  }

  formatViews(count: number | null): string {
    if (count === null) {
      return '';
    }

    return `${new Intl.NumberFormat('en', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(count)} views`;
  }

  formatPublishedAt(value: string): string {
    const date = new Date(value);
    const timestamp = date.getTime();

    if (!value || Number.isNaN(timestamp)) {
      return '';
    }

    const seconds = Math.max(
      0,
      Math.floor((Date.now() - timestamp) / 1000)
    );

    const units: Array<{
      size: number;
      unit: Intl.RelativeTimeFormatUnit;
    }> = [
      { size: 31536000, unit: 'year' },
      { size: 2592000, unit: 'month' },
      { size: 604800, unit: 'week' },
      { size: 86400, unit: 'day' },
      { size: 3600, unit: 'hour' },
      { size: 60, unit: 'minute' }
    ];

    const formatter = new Intl.RelativeTimeFormat('en', {
      numeric: 'auto'
    });

    for (const { size, unit } of units) {
      if (seconds >= size) {
        return formatter.format(-Math.floor(seconds / size), unit);
      }
    }

    return 'Just now';
  }

  channelInitial(): string {
    return this.video().channelName.trim().charAt(0).toUpperCase() || 'C';
  }

  toggleWatchLater(): void {
    this.library.toggleWatchLater(this.video());
  }
}
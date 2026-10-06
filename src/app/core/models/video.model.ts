export interface Video {
  id: string;
  youtubeId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelId: string;
  channelName: string;
  channelAvatarUrl: string;
  publishedAt: string;
  durationSeconds: number | null;
  viewCount: number | null;
  category: string;
  language: string;
  isShort: boolean;
}
import { Video } from './video.model';

export interface Playlist {
  id: string;
  name: string;
  description: string;
  videos: Video[];
  createdAt: string;
  updatedAt: string;
}
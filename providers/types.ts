import type { Format, MediaInfo, Job, Source } from '@/lib/types';

export type DownloadOptions = { url: string; formatId: string; quality: string; format: string };

export interface Provider {
  source: Source;
  canHandle(url: string): boolean;
  analyze(url: string): Promise<MediaInfo>;
  getFormats(url: string): Promise<Format[]>;
  createDownloadJob(options: DownloadOptions): Promise<Job>;
  validate(url: string): Promise<void>;
}

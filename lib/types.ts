export type Source = 'youtube' | 'instagram' | 'pinterest' | 'direct';
export type MediaType = 'video' | 'audio' | 'image' | 'unknown';
export type DownloadStatus = 'queued' | 'analyzing' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type Format = {
  id: string;
  container: string;
  label: string;
  kind: 'video' | 'audio' | 'image';
  extension: string;
  mime?: string;
  width?: number;
  height?: number;
  fps?: number;
  filesize?: number;
  videoCodec?: string;
  audioCodec?: string;
  hasAudio?: boolean;
};

export type MediaInfo = {
  success: boolean;
  source: Source;
  title: string;
  creator?: string;
  thumbnail?: string;
  duration?: number;
  mediaType: MediaType;
  formats: Format[];
  outputFormats: string[];
  estimatedSize?: number;
};

export type Job = {
  id: string;
  status: DownloadStatus;
  progress: number;
  downloadedBytes?: number;
  totalBytes?: number;
  speedBytesPerSecond?: number;
  etaSeconds?: number;
  filename?: string;
  downloadUrl?: string;
  error?: string;
  history?: {
    title: string;
    source: string;
    quality: string;
    format: string;
    thumbnail?: string;
  };
};

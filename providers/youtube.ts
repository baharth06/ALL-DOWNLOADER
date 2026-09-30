import type { Provider } from './types';

export const youtubeProvider: Provider = {
  source: 'youtube',
  canHandle(url) { return /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(new URL(url).hostname); },
  async analyze() { throw new Error('YouTube extraction is handled by MEDIA_WORKER_URL.'); },
  async getFormats() { return []; },
  async createDownloadJob() { throw new Error('Use the API route for download jobs.'); },
  async validate() {},
};

import type { Provider } from './types';
export const pinterestProvider: Provider = { source: 'pinterest', canHandle: (u) => /(^|\.)pinterest\.com$|(^|\.)pinimg\.com$/i.test(new URL(u).hostname), async analyze(){ throw new Error('Handled by media worker.'); }, async getFormats(){ return []; }, async createDownloadJob(){ throw new Error('Handled by media worker.'); }, async validate(){} };

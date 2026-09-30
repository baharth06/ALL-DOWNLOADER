import type { Provider } from './types';
export const directMediaProvider: Provider = { source: 'direct', canHandle: () => true, async analyze(){ throw new Error('Handled by media worker.'); }, async getFormats(){ return []; }, async createDownloadJob(){ throw new Error('Handled by media worker.'); }, async validate(){} };

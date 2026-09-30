import { youtubeProvider } from './youtube';
import { instagramProvider } from './instagram';
import { pinterestProvider } from './pinterest';
import { directMediaProvider } from './direct';

export const providers = [youtubeProvider, instagramProvider, pinterestProvider, directMediaProvider];
export function detectProvider(url: string) { return providers.find((provider) => provider.canHandle(url)); }

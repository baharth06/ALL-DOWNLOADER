export const siteName = 'All Downloader';
export const defaultDescription = 'Download supported public media in the available quality and format from one fast, responsive tool.';

export function absoluteUrl(path = '/') {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return new URL(path, base).toString();
}

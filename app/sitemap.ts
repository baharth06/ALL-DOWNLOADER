import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';
export default function sitemap(): MetadataRoute.Sitemap { const paths=['/','/youtube-downloader','/instagram-downloader','/pinterest-downloader','/video-downloader','/audio-downloader','/image-downloader','/how-to-download','/supported-sources','/faq','/about','/contact','/privacy','/terms']; return paths.map((path)=>( {url:absoluteUrl(path),lastModified:new Date()} )); }

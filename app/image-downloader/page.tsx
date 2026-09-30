import { DownloaderLanding } from '@/components/DownloaderLanding';
export const metadata={title:'Image Downloader — Save Supported Images',description:'Download supported public images from accessible direct image URLs in the available source format.'};
export default function Page(){return <DownloaderLanding provider="Image" description="For public direct image URLs, inspect the detected media and save an accessible image format."/>}

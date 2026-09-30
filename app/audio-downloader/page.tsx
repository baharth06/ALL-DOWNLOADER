import { DownloaderLanding } from '@/components/DownloaderLanding';
export const metadata={title:'Audio Downloader — Download Supported Audio',description:'Analyze supported public media and choose an available audio format for permitted downloads.'};
export default function Page(){return <DownloaderLanding provider="Audio" description="Analyze supported media, then choose an available audio output where the source exposes or permits it."/>}

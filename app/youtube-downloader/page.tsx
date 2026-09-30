import { DownloaderLanding } from '@/components/DownloaderLanding';
export const metadata={title:'YouTube Downloader — Download Supported Videos in HD',description:'Analyze supported public YouTube media, view available qualities, and download permitted content.'};
export default function Page(){return <DownloaderLanding provider="YouTube" description="Analyze supported public YouTube media, inspect the formats returned by the source, and choose an available quality."/>}

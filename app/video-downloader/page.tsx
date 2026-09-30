import { DownloaderLanding } from '@/components/DownloaderLanding';
export const metadata={title:'Video Downloader — Download Supported Video',description:'Analyze supported public video URLs and choose an available video quality and format.'};
export default function Page(){return <DownloaderLanding provider="Video" description="Use one interface for supported public video URLs. The tool only presents formats returned by the source or worker."/>}

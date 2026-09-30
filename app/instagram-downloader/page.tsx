import { DownloaderLanding } from '@/components/DownloaderLanding';
export const metadata={title:'Instagram Downloader — Download Public Media',description:'Analyze supported public Instagram media and download only content the source makes available and you are permitted to use.'};
export default function Page(){return <DownloaderLanding provider="Instagram" description="Paste a public Instagram media URL, analyze what is actually accessible, and choose from returned formats."/>}

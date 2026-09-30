import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ThemeProvider } from '@/components/ThemeProvider';
import { absoluteUrl, defaultDescription, siteName } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: `${siteName} — Download Supported Media`, template: `%s | ${siteName}` },
  description: defaultDescription,
  alternates: { canonical: absoluteUrl('/') },
  openGraph: { title: siteName, description: defaultDescription, url: absoluteUrl('/'), siteName, type: 'website' },
  twitter: { card: 'summary_large_image', title: siteName, description: defaultDescription },
  robots: { index: true, follow: true },
  authors: [{ name: 'Vadakattu Bharath Kumar', url: 'https://bharath-kumar-vadakattu.vercel.app/' }],
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0d0e10' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jsonLd={
    '@context':'https://schema.org',
    '@graph':[
      {'@type':'WebSite','name':siteName,'url':absoluteUrl('/')},
      {'@type':'WebApplication','name':siteName,'url':absoluteUrl('/'),'applicationCategory':'MultimediaApplication','operatingSystem':'Web'},
      {'@type':'Organization','name':siteName,'url':absoluteUrl('/')}
    ]
  };
  return <html lang="en" suppressHydrationWarning><body><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd)}}/><ThemeProvider><div className="site-shell"><Navbar />{children}<Footer /></div></ThemeProvider></body></html>;
}

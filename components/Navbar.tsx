'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Moon, Sun, Monitor, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from './ThemeProvider';

export function Navbar(){
 const path=usePathname(); const [open,setOpen]=useState(false); const {theme,setTheme}=useTheme();
 const nav=[['/youtube-downloader','YouTube'],['/instagram-downloader','Instagram'],['/pinterest-downloader','Pinterest'],['/faq','FAQ']];
 return <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[color:var(--bg)]/85 backdrop-blur-xl">
  <div className="container-wide flex h-16 items-center justify-between">
   <Link href="/" className="flex items-center gap-2" onClick={()=>setOpen(false)}><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-sm font-black text-[var(--bg)]">AD</span><span className="font-semibold tracking-tight">All Downloader</span></Link>
   <nav className="hidden items-center gap-6 md:flex">{nav.map(([href,label])=><Link key={href} href={href} className={`text-sm transition hover:opacity-70 ${path===href?'font-semibold':'muted'}`}>{label}</Link>)}<Link href="/history" className="text-sm muted hover:opacity-70">History</Link><Link href="/settings" className="text-sm muted hover:opacity-70">Settings</Link>
   <div className="flex items-center gap-1 rounded-full border border-[var(--border)] p-1"><button aria-label="Light mode" onClick={()=>setTheme('light')} className={`rounded-full p-2 ${theme==='light'?'bg-[var(--accent)] text-[var(--bg)]':''}`}><Sun size={15}/></button><button aria-label="Dark mode" onClick={()=>setTheme('dark')} className={`rounded-full p-2 ${theme==='dark'?'bg-[var(--accent)] text-[var(--bg)]':''}`}><Moon size={15}/></button><button aria-label="System theme" onClick={()=>setTheme('system')} className={`rounded-full p-2 ${theme==='system'?'bg-[var(--accent)] text-[var(--bg)]':''}`}><Monitor size={15}/></button></div></nav>
   <button className="rounded-xl border border-[var(--border)] p-2 md:hidden" aria-label="Toggle menu" onClick={()=>setOpen(v=>!v)}>{open?<X size={19}/>:<Menu size={19}/>}</button>
  </div>
  {open && <div className="border-t border-[var(--border)] md:hidden"><nav className="container-wide flex flex-col gap-1 py-3">{nav.concat([['/history','History'],['/settings','Settings']]).map(([href,label])=><Link onClick={()=>setOpen(false)} className="rounded-xl px-3 py-3 muted hover:bg-black/5 dark:hover:bg-white/5" key={href} href={href}>{label}</Link>)}</nav></div>}
 </header>
}

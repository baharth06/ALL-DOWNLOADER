import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest { return {name:'All Downloader',short_name:'All Downloader',description:'Paste. Choose. Download.',start_url:'/',display:'standalone',background_color:'#0d0e10',theme_color:'#0d0e10',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml'}]}; }

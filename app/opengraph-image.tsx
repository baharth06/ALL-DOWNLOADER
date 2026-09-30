import { ImageResponse } from 'next/og';
export const alt='All Downloader — Paste. Choose. Download.';
export const size={width:1200,height:630}; export const contentType='image/png';
export default function Image(){ return new ImageResponse(<div style={{height:'100%',width:'100%',display:'flex',flexDirection:'column',alignItems:'flex-start',justifyContent:'center',padding:'80px',background:'#0d0e10',color:'#fff',fontFamily:'sans-serif'}}><div style={{fontSize:30,fontWeight:700,opacity:.8}}>ALL DOWNLOADER</div><div style={{fontSize:72,fontWeight:800,marginTop:24,letterSpacing:-3}}>Paste. Choose. Download.</div><div style={{fontSize:28,marginTop:20,opacity:.68}}>Fast • Simple • Responsive</div></div>,size); }

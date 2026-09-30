import { ImageResponse } from 'next/og';
export const size={width:64,height:64}; export const contentType='image/png';
export default function Icon(){return new ImageResponse(<div style={{width:64,height:64,borderRadius:16,background:'#111827',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:800}}>AD</div>,size)}

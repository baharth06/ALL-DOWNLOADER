import dns from 'node:dns/promises';
import net from 'node:net';

function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a,b] = ip.split('.').map(Number);
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127 || a === 0 || (a === 169 && b === 254);
  }
  return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb');
}

export async function assertPublicUrl(raw: string) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) URLs are supported.');
  if (!url.hostname || ['localhost','127.0.0.1','0.0.0.0','::1'].includes(url.hostname.toLowerCase())) throw new Error('Private hosts are not allowed.');
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (addresses.some(({address}) => isPrivateIp(address))) throw new Error('Private network destinations are not allowed.');
  return url;
}

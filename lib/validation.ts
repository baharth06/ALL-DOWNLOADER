export function isValidHttpUrl(input: string) {
  try {
    const url = new URL(input);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function classifySource(input: string) {
  try {
    const host = new URL(input).hostname.toLowerCase();
    if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return 'youtube';
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
    if (host === 'pinterest.com' || host.endsWith('.pinterest.com') || host.endsWith('.pinimg.com')) return 'pinterest';
    return 'generic';
  } 
  catch { return 'generic'; }
}

export function publicUrl(input: string) {
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch { return null; }
}

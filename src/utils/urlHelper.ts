export function getAbsoluteUrl(path: string) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//') || path.startsWith('data:')) {
    return path;
  }
  let serverUrl = (localStorage.getItem('server_url') || import.meta.env.VITE_SERVER_URL || 'https://biology7.vercel.app').replace(/\/$/, '');
  if (serverUrl.includes('railway') || serverUrl.includes('biology-server')) {
    serverUrl = 'https://biology7.vercel.app';
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${serverUrl}${cleanPath}`;
}

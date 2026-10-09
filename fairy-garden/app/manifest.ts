import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fairy Garden Askeleet',
    short_name: 'Fairy Garden',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff5fb',
    theme_color: '#f8d7ec',
    icons: [{ src: '/icon', sizes: 'any', type: 'image/svg+xml' }],
  };
}

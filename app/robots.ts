import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private / session-only surfaces — no value in the index
        disallow: ['/api/', '/game/', '/settings/', '/profile', '/verify'],
      },
    ],
    sitemap: 'https://poker.sanskarshukla.com/sitemap.xml',
  }
}

import type { MetadataRoute } from 'next'

const SITE_URL = 'https://poker.sanskarshukla.com'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`,       changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${SITE_URL}/signup`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/login`,  changeFrequency: 'monthly', priority: 0.5 },
  ]
}

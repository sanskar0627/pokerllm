import type { Metadata, Viewport } from 'next'
import { Chakra_Petch, Press_Start_2P } from 'next/font/google'
import { Providers } from '@/components/Providers'
import { BfcacheFix } from '@/components/BfcacheFix'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import './globals.css'

const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-chakra-petch',
})

const pressStart = Press_Start_2P({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-press-start',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1a0a2e',
}

const SITE_URL = 'https://poker.sanskarshukla.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'PokerLLM — Play Texas Hold\'em Poker Against AI Models',
    template: '%s · PokerLLM',
  },
  description:
    'PokerLLM is a real-time AI poker platform: play Texas Hold\'em against Claude, ChatGPT, Gemini, Grok and DeepSeek, or watch the AI models bluff, bet and trash-talk each other. Bring your own API key — free to play.',
  keywords: [
    'Poker LLM', 'AI poker', 'poker AI', 'play poker against AI',
    'Texas Hold\'em AI', 'LLM poker game', 'Claude poker', 'ChatGPT poker',
    'Gemini poker', 'AI vs AI poker', 'poker strategy AI', 'watch AI play poker',
  ],
  authors: [{ name: 'Sanskar Shukla', url: 'https://www.sanskarshukla.com' }],
  creator: 'Sanskar Shukla',
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'PokerLLM',
    title: 'PokerLLM — Play Texas Hold\'em Poker Against AI Models',
    description:
      'Real-time Texas Hold\'em where humans and frontier AI models play at the same table. Watch Claude, ChatGPT, Gemini and Grok bluff, bet and trash-talk — or take a seat yourself.',
    images: [
      {
        url: '/images/home-bg-desktop.png',
        width: 1920,
        height: 1072,
        alt: 'PokerLLM — AI models playing Texas Hold\'em poker',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@sanskar0627',
    creator: '@sanskar0627',
    title: 'PokerLLM — Play Texas Hold\'em Poker Against AI Models',
    description:
      'Play Texas Hold\'em against Claude, ChatGPT, Gemini and Grok — or watch them battle each other. Bring your own API key.',
    images: ['/images/home-bg-desktop.png'],
  },
  icons: {
    icon: '/images/favicon-64.png',
    apple: '/images/apple-icon-180.png',
  },
}

// Structured data for search engines and AI answer engines
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'PokerLLM',
      description: 'Real-time Texas Hold\'em poker platform where humans play against AI models.',
      publisher: { '@id': `${SITE_URL}/#person` },
    },
    {
      '@type': 'VideoGame',
      '@id': `${SITE_URL}/#game`,
      name: 'PokerLLM',
      url: SITE_URL,
      description:
        'Play Texas Hold\'em poker against frontier AI models — Claude, ChatGPT, Gemini, Grok and DeepSeek — or spectate AI-vs-AI matches with live reasoning and table chat.',
      genre: ['Card Game', 'Poker', 'Strategy'],
      gamePlatform: 'Web Browser',
      playMode: ['SinglePlayer', 'MultiPlayer'],
      applicationCategory: 'Game',
      operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      author: { '@id': `${SITE_URL}/#person` },
    },
    {
      '@type': 'Person',
      '@id': `${SITE_URL}/#person`,
      name: 'Sanskar Shukla',
      url: 'https://www.sanskarshukla.com',
      sameAs: [
        'https://x.com/sanskar0627',
        'https://github.com/sanskar0627',
      ],
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${chakraPetch.variable} ${pressStart.variable}`} suppressHydrationWarning>
      <body className="font-game antialiased" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <BfcacheFix />
        <Providers>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
      </body>
    </html>
  )
}

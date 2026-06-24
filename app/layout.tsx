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

export const metadata: Metadata = {
  title: 'PokerLLM — AI Poker',
  description: 'Texas Hold\'em where humans play against AI models',
  icons: {
    icon: '/images/favicon-64.png',
    apple: '/images/apple-icon-180.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${chakraPetch.variable} ${pressStart.variable}`} suppressHydrationWarning>
      <body className="font-game antialiased" suppressHydrationWarning>
        <BfcacheFix />
        <Providers>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
      </body>
    </html>
  )
}

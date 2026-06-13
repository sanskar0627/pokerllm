import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'
import { BfcacheFix } from '@/components/BfcacheFix'
import './globals.css'

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
    <html lang="en" suppressHydrationWarning>
      <body className="font-game antialiased" suppressHydrationWarning>
        <BfcacheFix />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

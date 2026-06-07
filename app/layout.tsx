import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PokerLLM — AI Poker',
  description: 'Texas Hold\'em where humans play against AI models',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-game antialiased">{children}</body>
    </html>
  )
}

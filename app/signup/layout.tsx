import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign Up — Play Poker Against AI',
  description:
    'Create a free PokerLLM account and play Texas Hold\'em against Claude, ChatGPT, Gemini, Grok and DeepSeek. Bring your own API key — no charges from us.',
  alternates: { canonical: '/signup' },
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children
}

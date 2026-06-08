import type { AIModel } from '@/types/poker'

export interface AIMeta {
  id:       AIModel
  label:    string
  company:  string
  tagline:  string
  logoUrl:  string          // external logo URL for avatar
  // All Tailwind classes written in full so the compiler never purges them
  border:   string
  activeBorder: string
  shadow:   string
  bg:       string
  bgMuted:  string
  text:     string
  dot:      string
  cardBack: string
}

export const AI_META: Record<AIModel, AIMeta> = {
  claude: {
    id:           'claude',
    label:        'Claude',
    company:      'Anthropic',
    tagline:      'Careful · Strategic · Principled',
    logoUrl:      'https://cdn.worldvectorlogo.com/logos/anthropic-2.svg',
    border:       'border-[#FFD700]/60',
    activeBorder: 'border-[#FFD700]',
    shadow:       'shadow-[#FFD700]/30',
    bg:           'bg-[#FFD700]',
    bgMuted:      'bg-[#FFD700]/10',
    text:         'text-[#FFD700]',
    dot:          'bg-[#FFD700]',
    cardBack:     'from-[#3d1a6e] to-[#1a0a2e]',
  },
  chatgpt: {
    id:           'chatgpt',
    label:        'ChatGPT',
    company:      'OpenAI',
    tagline:      'Aggressive · Adaptive · Sharp',
    logoUrl:      'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg',
    border:       'border-[#FFD700]/60',
    activeBorder: 'border-[#FFD700]',
    shadow:       'shadow-[#FFD700]/30',
    bg:           'bg-[#FFD700]',
    bgMuted:      'bg-[#FFD700]/10',
    text:         'text-[#FFD700]',
    dot:          'bg-[#FFD700]',
    cardBack:     'from-[#3d1a6e] to-[#1a0a2e]',
  },
  gemini: {
    id:           'gemini',
    label:        'Gemini',
    company:      'Google',
    tagline:      'Analytical · Balanced · Precise',
    logoUrl:      'https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg',
    border:       'border-[#FFD700]/60',
    activeBorder: 'border-[#FFD700]',
    shadow:       'shadow-[#FFD700]/30',
    bg:           'bg-[#FFD700]',
    bgMuted:      'bg-[#FFD700]/10',
    text:         'text-[#FFD700]',
    dot:          'bg-[#FFD700]',
    cardBack:     'from-[#3d1a6e] to-[#1a0a2e]',
  },
  grok: {
    id:           'grok',
    label:        'Grok',
    company:      'xAI',
    tagline:      'Bold · Unpredictable · Contrarian',
    logoUrl:      'https://upload.wikimedia.org/wikipedia/commons/7/7d/X.AI_logo.svg',
    border:       'border-[#FFD700]/60',
    activeBorder: 'border-[#FFD700]',
    shadow:       'shadow-[#FFD700]/30',
    bg:           'bg-[#FFD700]',
    bgMuted:      'bg-[#FFD700]/10',
    text:         'text-[#FFD700]',
    dot:          'bg-[#FFD700]',
    cardBack:     'from-[#3d1a6e] to-[#1a0a2e]',
  },
  deepseek: {
    id:           'deepseek',
    label:        'DeepSeek',
    company:      'DeepSeek',
    tagline:      'Methodical · Patient · Mathematical',
    logoUrl:      'https://upload.wikimedia.org/wikipedia/commons/e/ec/DeepSeek_logo.svg',
    border:       'border-[#FFD700]/60',
    activeBorder: 'border-[#FFD700]',
    shadow:       'shadow-[#FFD700]/30',
    bg:           'bg-[#FFD700]',
    bgMuted:      'bg-[#FFD700]/10',
    text:         'text-[#FFD700]',
    dot:          'bg-[#FFD700]',
    cardBack:     'from-[#3d1a6e] to-[#1a0a2e]',
  },
  groq: {
    id:           'groq',
    label:        'Groq',
    company:      'Groq (Llama 3.3)',
    tagline:      'Lightning · Fearless · Relentless',
    logoUrl:      'https://groq.com/wp-content/uploads/2024/03/PBG-mark1-color.svg',
    border:       'border-[#FFD700]/60',
    activeBorder: 'border-[#FFD700]',
    shadow:       'shadow-[#FFD700]/30',
    bg:           'bg-[#FFD700]',
    bgMuted:      'bg-[#FFD700]/10',
    text:         'text-[#FFD700]',
    dot:          'bg-[#FFD700]',
    cardBack:     'from-[#3d1a6e] to-[#1a0a2e]',
  },
}

export const AI_META_LIST = Object.values(AI_META)

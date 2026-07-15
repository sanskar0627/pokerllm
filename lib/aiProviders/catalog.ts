/**
 * AI Provider catalog — CLIENT-SAFE (no secrets, no server imports).
 *
 * Single source of truth for every supported provider. Adding a provider:
 * add one entry here; if it speaks the OpenAI chat API (`wire: 'openai'`),
 * no new adapter code is needed anywhere else.
 */

export type ProviderId =
  | 'claude'
  | 'chatgpt'
  | 'grok'
  | 'gemini'
  | 'deepseek'
  | 'groq'
  | 'mistral'
  | 'openrouter'
  | 'ollama'
  | 'custom'

/** Wire protocol used to talk to the provider. */
export type WireProtocol = 'anthropic' | 'google' | 'openai'

export interface ModelInfo {
  id:          string
  label:       string
  description: string
  orId?:       string   // this model's id on OpenRouter (when routed via OpenRouter)
}

/** How a config's key routes: the provider's official API, or OpenRouter. */
export type KeyVia = 'official' | 'openrouter'

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
export const OPENROUTER_KEYS_URL = 'https://openrouter.ai/keys'

export interface ProviderInfo {
  id:            ProviderId
  label:         string
  company:       string
  wire:          WireProtocol
  accent:        string          // brand color for UI
  keyHint:       string          // expected key prefix/shape, shown as placeholder
  docsUrl:       string          // where to create a key
  baseUrl?:      string          // default endpoint for openai-wire providers
  requiresKey:   boolean         // ollama typically runs keyless locally
  allowsBaseUrl: boolean         // user may override the endpoint
  isCustom?:     boolean
  playable:      boolean         // can currently be seated at the poker table
  models:        ModelInfo[]     // curated list; users can always type a custom id
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  claude: {
    id: 'claude', label: 'Claude', company: 'Anthropic', wire: 'anthropic',
    accent: '#D97757', keyHint: 'sk-ant-...', docsUrl: 'https://console.anthropic.com/settings/keys',
    requiresKey: true, allowsBaseUrl: false, playable: true,
    models: [
      { id: 'claude-fable-5',     label: 'Claude Fable 5',    description: 'Most capable Claude — next-gen intelligence', orId: 'anthropic/claude-fable-5' },
      { id: 'claude-opus-4-8',    label: 'Claude Opus 4.8',   description: 'Complex agentic coding, 1M context', orId: 'anthropic/claude-opus-4-8' },
      { id: 'claude-sonnet-5',    label: 'Claude Sonnet 5',   description: 'Best speed + intelligence balance', orId: 'anthropic/claude-sonnet-5' },
      { id: 'claude-opus-4-7',    label: 'Claude Opus 4.7',   description: 'Previous Opus flagship', orId: 'anthropic/claude-opus-4-7' },
      { id: 'claude-haiku-4-5',   label: 'Claude Haiku 4.5',  description: 'Fastest — great for quick games', orId: 'anthropic/claude-haiku-4.5' },
      { id: 'claude-sonnet-4-6',  label: 'Claude Sonnet 4.6', description: 'Previous Sonnet generation', orId: 'anthropic/claude-sonnet-4.6' },
      { id: 'claude-opus-4-6',    label: 'Claude Opus 4.6',   description: 'Legacy Opus, still solid', orId: 'anthropic/claude-opus-4.6' },
    ],
  },
  chatgpt: {
    id: 'chatgpt', label: 'ChatGPT', company: 'OpenAI', wire: 'openai',
    accent: '#10A37F', keyHint: 'sk-...', docsUrl: 'https://platform.openai.com/api-keys',
    requiresKey: true, allowsBaseUrl: false, playable: true,
    models: [
      { id: 'gpt-5.6',      label: 'GPT-5.6 Sol',  description: 'Newest frontier flagship', orId: 'openai/gpt-5.6' },
      { id: 'gpt-5.6-terra',label: 'GPT-5.6 Terra', description: 'Intelligence + cost balance', orId: 'openai/gpt-5.6-terra' },
      { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', description: 'Efficient high-volume model', orId: 'openai/gpt-5.6-luna' },
      { id: 'gpt-5.5',      label: 'GPT-5.5',      description: 'Previous frontier release', orId: 'openai/gpt-5.5' },
      { id: 'gpt-5.3-codex',label: 'GPT-5.3 Codex', description: 'Best-in-class code generation', orId: 'openai/gpt-5.3-codex' },
      { id: 'gpt-5.2',      label: 'GPT-5.2',      description: 'Stable and reliable', orId: 'openai/gpt-5.2' },
      { id: 'gpt-5',        label: 'GPT-5',        description: 'Original GPT-5 flagship', orId: 'openai/gpt-5' },
    ],
  },
  grok: {
    id: 'grok', label: 'Grok', company: 'xAI', wire: 'openai',
    accent: '#FF6B35', keyHint: 'xai-...', docsUrl: 'https://console.x.ai',
    baseUrl: 'https://api.x.ai/v1',
    requiresKey: true, allowsBaseUrl: false, playable: true,
    models: [
      { id: 'grok-4.5',        label: 'Grok 4.5',        description: 'Current flagship — coding + knowledge', orId: 'x-ai/grok-4.5' },
      { id: 'grok-4.5-latest', label: 'Grok 4.5 latest', description: 'Auto-tracks newest 4.5 release', orId: 'x-ai/grok-4.5' },
      { id: 'grok-420-reasoning', label: 'Grok 420 Reasoning', description: 'Deep reasoning, 256K context', orId: 'x-ai/grok-420-reasoning' },
      { id: 'grok-4.3',        label: 'Grok 4.3',        description: 'Previous flagship, fast + reliable', orId: 'x-ai/grok-4.3' },
      { id: 'grok-build-0.1',  label: 'Grok Build 0.1',  description: 'Fast agentic coding, 100+ tok/s', orId: 'x-ai/grok-build-0.1' },
    ],
  },
  gemini: {
    id: 'gemini', label: 'Gemini', company: 'Google', wire: 'google',
    accent: '#8B6CFF', keyHint: 'AIza...', docsUrl: 'https://aistudio.google.com/apikey',
    requiresKey: true, allowsBaseUrl: false, playable: true,
    models: [
      { id: 'gemini-3.5-flash',      label: 'Gemini 3.5 Flash',      description: 'Most intelligent — agentic flagship', orId: 'google/gemini-3.5-flash' },
      { id: 'gemini-3.1-pro',        label: 'Gemini 3.1 Pro',        description: 'Reasoning-first, 1M context', orId: 'google/gemini-3.1-pro' },
      { id: 'gemini-3.1-flash',      label: 'Gemini 3.1 Flash',      description: 'Most cost-efficient, high volume', orId: 'google/gemini-3.1-flash' },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', description: 'Frontier quality at low cost', orId: 'google/gemini-3.1-flash-lite' },
      { id: 'gemini-2.5-flash',      label: 'Gemini 2.5 Flash',      description: 'Reliable price-performance', orId: 'google/gemini-2.5-flash' },
      { id: 'gemini-2.5-pro',        label: 'Gemini 2.5 Pro',        description: 'Previous-gen deep reasoning', orId: 'google/gemini-2.5-pro' },
    ],
  },
  deepseek: {
    id: 'deepseek', label: 'DeepSeek', company: 'DeepSeek', wire: 'openai',
    accent: '#00B4D8', keyHint: 'sk-...', docsUrl: 'https://platform.deepseek.com/api_keys',
    baseUrl: 'https://api.deepseek.com',
    requiresKey: true, allowsBaseUrl: false, playable: true,
    models: [
      { id: 'deepseek-v4-pro',   label: 'DeepSeek V4 Pro',   description: 'Flagship — deep reasoning, 1M context', orId: 'deepseek/deepseek-v4-pro' },
      { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', description: 'Fast and cost-efficient', orId: 'deepseek/deepseek-v4-flash' },
      { id: 'deepseek-chat',     label: 'DeepSeek Chat',     description: 'Legacy alias — retires July 2026', orId: 'deepseek/deepseek-chat' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', description: 'Legacy thinking alias — retires July 2026', orId: 'deepseek/deepseek-r1' },
    ],
  },
  groq: {
    id: 'groq', label: 'Groq', company: 'Groq', wire: 'openai',
    accent: '#F55036', keyHint: 'gsk_...', docsUrl: 'https://console.groq.com/keys',
    baseUrl: 'https://api.groq.com/openai/v1',
    requiresKey: true, allowsBaseUrl: false, playable: true,
    models: [
      { id: 'openai/gpt-oss-120b',                    label: 'GPT-OSS 120B',   description: 'Open OpenAI model — big and fast', orId: 'openai/gpt-oss-120b' },
      { id: 'openai/gpt-oss-20b',                     label: 'GPT-OSS 20B',    description: 'Instant responses', orId: 'openai/gpt-oss-20b' },
      { id: 'qwen/qwen3.6-27b',                       label: 'Qwen 3.6 27B',   description: 'Fast open-weight model', orId: 'qwen/qwen3.6-27b' },
      { id: 'moonshotai/kimi-k2-instruct-0905',       label: 'Kimi K2',        description: 'Strong open agentic model', orId: 'moonshotai/kimi-k2-instruct' },
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout', description: 'Meta latest open model', orId: 'meta-llama/llama-4-scout-17b-16e-instruct' },
    ],
  },
  mistral: {
    id: 'mistral', label: 'Mistral', company: 'Mistral AI', wire: 'openai',
    accent: '#FA5F1C', keyHint: 'Your Mistral key', docsUrl: 'https://console.mistral.ai/api-keys',
    baseUrl: 'https://api.mistral.ai/v1',
    requiresKey: true, allowsBaseUrl: false, playable: false,
    models: [
      { id: 'mistral-large-latest', label: 'Mistral Large 3', description: 'Flagship 675B MoE', orId: 'mistralai/mistral-large' },
      { id: 'mistral-small-latest', label: 'Mistral Small 4', description: 'Reasoning + vision, very cheap', orId: 'mistralai/mistral-small' },
      { id: 'mistral-large-2512',   label: 'Large 3 (pinned)', description: 'Pinned December snapshot', orId: 'mistralai/mistral-large-2411' },
      { id: 'ministral-8b-latest',  label: 'Ministral 8B',    description: 'Compact edge model', orId: 'mistralai/ministral-8b' },
      { id: 'open-mistral-nemo',    label: 'Mistral Nemo',    description: 'Open-weights 12B', orId: 'mistralai/mistral-nemo' },
    ],
  },
  openrouter: {
    id: 'openrouter', label: 'OpenRouter', company: 'OpenRouter', wire: 'openai',
    accent: '#94A3B8', keyHint: 'sk-or-...', docsUrl: 'https://openrouter.ai/keys',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresKey: true, allowsBaseUrl: false, playable: false,
    models: [
      { id: 'anthropic/claude-fable-5',          label: 'Claude Fable 5',    description: 'Via OpenRouter' },
      { id: 'anthropic/claude-sonnet-5',         label: 'Claude Sonnet 5',   description: 'Via OpenRouter' },
      { id: 'openai/gpt-5.6',                    label: 'GPT-5.6 Sol',      description: 'Via OpenRouter' },
      { id: 'x-ai/grok-4.5',                     label: 'Grok 4.5',         description: 'Via OpenRouter' },
      { id: 'google/gemini-3.5-flash',           label: 'Gemini 3.5 Flash', description: 'Via OpenRouter' },
      { id: 'deepseek/deepseek-v4-pro',          label: 'DeepSeek V4 Pro',  description: 'Via OpenRouter' },
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout', description: 'Open weights' },
    ],
  },
  ollama: {
    id: 'ollama', label: 'Ollama', company: 'Local', wire: 'openai',
    accent: '#E2E8F0', keyHint: 'ollama (any value works)', docsUrl: 'https://ollama.com/download',
    baseUrl: 'http://localhost:11434/v1',
    requiresKey: false, allowsBaseUrl: true, playable: false,
    models: [
      { id: 'llama3.1',    label: 'Llama 3.1',    description: 'Meta open model' },
      { id: 'qwen3',       label: 'Qwen 3',       description: 'Alibaba open model' },
      { id: 'gemma3',      label: 'Gemma 3',      description: 'Google open model' },
      { id: 'deepseek-r1', label: 'DeepSeek R1',  description: 'Local reasoning model' },
      { id: 'mistral',     label: 'Mistral 7B',   description: 'Compact and quick' },
      { id: 'phi4',        label: 'Phi-4',        description: 'Microsoft small model' },
    ],
  },
  custom: {
    id: 'custom', label: 'Other', company: 'Custom Provider', wire: 'openai',
    accent: '#FFD700', keyHint: 'Your API key', docsUrl: '',
    requiresKey: true, allowsBaseUrl: true, isCustom: true, playable: true,
    models: [], // model id is free-form for custom providers
  },
}

export const PROVIDER_LIST = Object.values(PROVIDERS)

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[]

export function isProviderId(v: unknown): v is ProviderId {
  return typeof v === 'string' && v in PROVIDERS
}

/** Shape returned to the settings UI — never contains key material. */
export interface ProviderConfigDTO {
  provider:        ProviderId
  slot:            number
  via:             KeyVia
  model:           string
  keyLast4:        string
  customName:      string | null
  baseUrl:         string | null
  isActive:        boolean
  status:          'unverified' | 'valid' | 'invalid'
  lastValidatedAt: string | null
  lastError:       string | null
  updatedAt:       string
}

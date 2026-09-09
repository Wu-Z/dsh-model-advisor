/**
 * Configuration links: where to get a key, what the provider charges, and the
 * harness surfaces that own the actual configuration.
 */

/** Provider id → console page that issues an API key. */
const CONSOLE = {
  deepseek: 'https://platform.deepseek.com/api_keys',
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  google: 'https://aistudio.google.com/apikey',
  xai: 'https://console.x.ai',
  moonshotai: 'https://platform.moonshot.cn/console/api-keys',
  moonshot: 'https://platform.moonshot.cn/console/api-keys',
  zai: 'https://z.ai/manage-apikey/apikey-list',
  zhipuai: 'https://open.bigmodel.cn/usercenter/apikeys',
  minimax: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
  alibaba: 'https://bailian.console.aliyun.com',
  dashscope: 'https://bailian.console.aliyun.com',
  qwen: 'https://bailian.console.aliyun.com',
  openrouter: 'https://openrouter.ai/keys',
  siliconflow: 'https://cloud.siliconflow.cn/account/ak',
  volcengine: 'https://console.volcengine.com/ark',
  groq: 'https://console.groq.com/keys',
  mistral: 'https://console.mistral.ai/api-keys',
  together: 'https://api.together.ai/settings/api-keys',
  deepinfra: 'https://deepinfra.com/dash/api_keys',
  cerebras: 'https://cloud.cerebras.ai',
  nvidia: 'https://build.nvidia.com',
  perplexity: 'https://www.perplexity.ai/settings/api',
  cohere: 'https://dashboard.cohere.com/api-keys',
  fireworks: 'https://fireworks.ai/account/api-keys',
  baseten: 'https://www.baseten.co',
  vercel: 'https://vercel.com/account/tokens',
  ollama: 'https://ollama.com/settings/keys',
  azure: 'https://portal.azure.com',
  bedrock: 'https://console.aws.amazon.com/bedrock',
  amazon: 'https://console.aws.amazon.com/bedrock',
  'github-copilot': 'https://github.com/settings/copilot',
  opencode: 'https://opencode.ai/auth',
}

/** External link set for one provider. */
export function linksFor(provider, doc) {
  const consoleUrl = CONSOLE[provider] ?? ''
  return {
    consoleUrl,
    doc: typeof doc === 'string' ? doc : '',
  }
}

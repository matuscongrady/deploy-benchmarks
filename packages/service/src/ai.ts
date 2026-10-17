import type OpenAI from 'openai';
import { openai } from './clients';

const MODEL = process.env.OPENAI_MODEL ?? 'gpt-5-mini';

/** The chat request that drafts a product description. */
export function describeProductRequest(product: { name: string; category: string }): OpenAI.Chat.ChatCompletionCreateParamsNonStreaming {
  return {
    model: MODEL,
    messages: [
      { role: 'system', content: 'You write short, factual product descriptions for an online shop.' },
      { role: 'user', content: `Describe "${product.name}" in the ${product.category} category in two sentences.` }
    ]
  };
}

/** The moderation request for a customer review. */
export const moderationRequest = (text: string): OpenAI.ModerationCreateParams => ({ model: 'omni-moderation-latest', input: text });
export const apiBase = () => openai.baseURL;

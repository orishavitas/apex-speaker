// Resolves the best available LLM provider at runtime.
// Priority: Gemini 2.5 Flash → Anthropic Sonnet 4.6 → Gemma 4 (via Google)
// Falls back based on which API keys are present in the environment.

import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";

export function getModel() {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google("gemini-2.5-flash");
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return anthropic("claude-sonnet-4.6");
  }
  // Final fallback: Gemma 4 via Google (same key, different model)
  return google("gemma-3-27b-it");
}

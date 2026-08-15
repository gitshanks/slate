import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type AIProvider = "anthropic" | "gemini" | "openai";
export type OpenAIProvider = Extract<AIProvider, "gemini" | "openai">;

function resolveProvider(): AIProvider | null {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return "anthropic";
  }
  if (explicit === "gemini" && process.env.GEMINI_API_KEY) {
    return "gemini";
  }
  if (explicit === "openai" && process.env.OPENAI_API_KEY) {
    return "openai";
  }

  // Hosted Slate prefers Gemini for quality, with the existing
  // OpenAI-compatible provider (Groq by default) retained as fallback.
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export const AI_PROVIDER = resolveProvider();
export const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-opus-4-7";
export const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.7-flash";
export const OPENAI_MODEL =
  process.env.OPENAI_MODEL || "openai/gpt-oss-120b";

const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/";
const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL || "https://api.groq.com/openai/v1";

let anthropicClient: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

export interface OpenAIBackend {
  client: OpenAI;
  model: string;
  provider: OpenAIProvider;
}

let geminiClient: OpenAI | null = null;
let openaiClient: OpenAI | null = null;

export function getOpenAIBackend(provider: OpenAIProvider): OpenAIBackend {
  if (provider === "gemini") {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini is not configured");
    }
    if (!geminiClient) {
      geminiClient = new OpenAI({
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: GEMINI_BASE_URL,
        maxRetries: 0,
        timeout: 30_000,
        defaultHeaders: {
          "x-goog-api-client": "slate-openai-compat/1.0.0",
        },
      });
    }
    return {
      client: geminiClient,
      model: GEMINI_MODEL,
      provider: "gemini",
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OpenAI-compatible AI is not configured");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: OPENAI_BASE_URL,
    });
  }
  return {
    client: openaiClient,
    model: OPENAI_MODEL,
    provider: "openai",
  };
}

/** Groq/OpenAI-compatible fallback for Gemini quota or provider failures. */
export function getOpenAIFallback(
  provider: AIProvider,
): OpenAIBackend | null {
  if (provider !== "gemini" || !process.env.OPENAI_API_KEY) return null;
  return getOpenAIBackend("openai");
}

import type { GenerateContentConfig, GoogleGenAI } from "@google/genai";

export type GenerateContentParams = {
  model: string;
  contents: string;
  config?: GenerateContentConfig;
};

export type GenerateContentResult = {
  text?: string;
};

export type LLMClient = {
  models: {
    generateContent: (params: GenerateContentParams) => Promise<GenerateContentResult>;
  };
};

/**
 * @google/genai의 `GoogleGenAI` 인스턴스는 우리 `LLMClient` 인터페이스를 만족한다.
 * Mock에서는 같은 모양의 객체로 대체한다.
 */
export type AnyLLMClient = LLMClient | GoogleGenAI;

export function extractText(response: GenerateContentResult): string {
  return typeof response.text === "string" ? response.text : "";
}

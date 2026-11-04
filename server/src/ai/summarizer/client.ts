import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { MAX_HIGHLIGHTS, MAX_SKILLS } from "./schema";

// The only file in the app that talks to Gemini. It sits behind a small
// interface so tests can pass in a fake model and never call the real API.

export type ModelRequest = {
  systemInstruction: string;
  prompt: string;
  // Aborted by summarize() when its timeout fires, so the HTTP request is cancelled.
  signal: AbortSignal;
};

export interface SummaryModelClient {
  // Returns the model's raw text. It is untrusted: the caller parses and validates it.
  generateJson(request: ModelRequest): Promise<string>;
}

export const GEMINI_MODEL = "gemini-2.5-flash";

// The shape Gemini is asked to produce. This is a request, not a guarantee:
// schema.ts (Zod) re-checks every response, including the length caps.
// A test keeps these property names in step with the Zod schema.
export const geminiResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      maxItems: String(MAX_SKILLS),
    },
    highlights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      maxItems: String(MAX_HIGHLIGHTS),
    },
  },
  required: ["skills", "highlights"],
  propertyOrdering: ["skills", "highlights"],
};

export function createGeminiClient({ apiKey }: { apiKey: string }): SummaryModelClient {
  const ai = new GoogleGenAI({ apiKey });

  return {
    async generateJson({ systemInstruction, prompt, signal }) {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
          responseSchema: geminiResponseSchema,
          // Extraction does not need "thinking"; turning it off makes calls faster and cheaper.
          thinkingConfig: { thinkingBudget: 0 },
          abortSignal: signal,
        },
      });
      const text = response.text;
      if (!text) throw new Error("Gemini returned no text");
      return text;
    },
  };
}

// Used when GEMINI_API_KEY is not set: every summary attempt fails cleanly
// (stored as status "error") while the rest of the app keeps working.
export const unconfiguredClient: SummaryModelClient = {
  async generateJson() {
    throw new Error("GEMINI_API_KEY is not set");
  },
};

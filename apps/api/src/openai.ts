import OpenAI from "openai";

export type OpenAIConfig = {
  configured: boolean;
  model: string;
};

export function getOpenAIConfig(): OpenAIConfig {
  return {
    configured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL ?? "gpt-5.5"
  };
}

export function createOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

export async function runOpenAISmokeTest(): Promise<{ model: string; output: string }> {
  const config = getOpenAIConfig();
  const client = createOpenAIClient();
  const response = await client.responses.create({
    model: config.model,
    input: "Reply with exactly: OpenAI setup ok"
  });

  return {
    model: config.model,
    output: response.output_text
  };
}

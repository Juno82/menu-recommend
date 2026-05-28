import type Anthropic from "@anthropic-ai/sdk";

export type LLMClient = {
  messages: Pick<Anthropic["messages"], "create">;
};

type MessagesResponse = Awaited<ReturnType<Anthropic["messages"]["create"]>>;

export function extractText(response: MessagesResponse | { content: unknown[] }): string {
  const blocks = (response as { content: unknown[] }).content;
  return blocks
    .filter(
      (block): block is { type: "text"; text: string } =>
        typeof block === "object" &&
        block !== null &&
        (block as { type?: string }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string",
    )
    .map((block) => block.text)
    .join("");
}

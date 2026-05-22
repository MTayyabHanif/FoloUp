import { PROMPT_FOOTER_TEMPLATE } from "@/lib/constants";

const normalizeWhitespace = (s: string): string =>
  s.replace(/\r\n/g, "\n").trim();

export function appendFooter(body: string): string {
  return `${body.trim()}\n\n${PROMPT_FOOTER_TEMPLATE}`;
}

export function stripFooter(prompt: string): string {
  const normalizedPrompt = normalizeWhitespace(prompt);
  const normalizedFooter = normalizeWhitespace(PROMPT_FOOTER_TEMPLATE);
  const idx = normalizedPrompt.lastIndexOf(normalizedFooter);

  if (idx === -1) {
    return prompt;
  }

  return normalizedPrompt.slice(0, idx).trim();
}

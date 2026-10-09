import { createHighlighter } from "shiki";

export type ExcerptLanguage = "csharp" | "kotlin" | "python";

let highlighterPromise: ReturnType<typeof createHighlighter> | undefined;

export async function highlightCode(
  code: string,
  language: ExcerptLanguage,
): Promise<string> {
  highlighterPromise ??= createHighlighter({
    langs: ["csharp", "kotlin", "python"],
    themes: ["github-dark"],
  });

  const highlighter = await highlighterPromise;
  return highlighter.codeToHtml(code, {
    lang: language,
    theme: "github-dark",
  });
}

export const highlightCSharp = (code: string): Promise<string> =>
  highlightCode(code, "csharp");

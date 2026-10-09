const LANGUAGE_ALIASES = {
  csharp: ["csharp", "cs"],
  kotlin: ["kotlin", "kt"],
  python: ["python", "py"],
};

const escapeRegExp = (value) => value.replace(/[.*+?^$()|[\]\\]/g, "\\$&");

export function extractCodeBlocks(markdown, language) {
  if (typeof markdown !== "string") {
    throw new TypeError("Excerpt Markdown must be a string.");
  }

  const aliases = LANGUAGE_ALIASES[language] ?? [language];
  const fence = String.fromCharCode(96);
  const openingFence = "(" + fence + "{3,}|~{3,})";
  const pattern = new RegExp(
    "^" + openingFence + "(?:" + aliases.map(escapeRegExp).join("|") +
      ")[ \\t]*\\r?\\n([\\s\\S]*?)^\\1[ \\t]*$",
    "gim",
  );

  return [...markdown.matchAll(pattern)].map((match) =>
    match[2].replace(/\r?\n$/, ""),
  );
}

export function extractCodeBlock(markdown, language, index = 0) {
  const blocks = extractCodeBlocks(markdown, language);
  const code = blocks[index];

  if (typeof code !== "string" || !code.trim()) {
    throw new RangeError("The requested code preview block is missing or empty.");
  }

  return code;
}

export const extractCSharpBlocks = (markdown) =>
  extractCodeBlocks(markdown, "csharp");

export const extractCSharpBlock = (markdown, index = 0) =>
  extractCodeBlock(markdown, "csharp", index);

export interface SubmitterAIResponse {
  answer: string;
  sources: string[];
  conversation_id?: string;
}

export function generateConversationId(): string {
  return Math.random().toString(36).substring(2, 8);
}

export async function querySubmitterAI(
  question: string,
  conversationId?: string
): Promise<SubmitterAIResponse> {
  const apiKey = process.env.SUBMITTERAI_API_KEY;
  const apiUrl = process.env.SUBMITTERAI_API_URL;
  if (!apiKey) throw new Error("SUBMITTERAI_API_KEY is not configured");
  if (!apiUrl) throw new Error("SUBMITTERAI_API_URL is not configured");

  const body: Record<string, string> = { question };
  if (conversationId) body.conversation_id = conversationId;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function isVerseSource(source: string): boolean {
  return /^\d+:\d+$/.test(source);
}

function safeCutPoint(text: string, max: number): number {
  if (text.length <= max) return text.length;

  let cut = max;

  // Avoid cutting inside a markdown link [text](url)
  const before = text.substring(0, cut);
  const lastBracket = before.lastIndexOf("[");
  if (lastBracket !== -1) {
    const bracketParen = text.indexOf("](", lastBracket);
    if (bracketParen !== -1) {
      if (bracketParen >= cut) {
        cut = lastBracket;
      } else {
        const closeParen = text.indexOf(")", bracketParen + 2);
        if (closeParen !== -1 && closeParen >= cut) {
          cut = lastBracket;
        }
      }
    }
  }

  // Prefer paragraph or line break
  const sub = text.substring(0, cut);
  const para = sub.lastIndexOf("\n\n");
  if (para > cut * 0.5) return para;
  const line = sub.lastIndexOf("\n");
  if (line > cut * 0.5) return line;

  return cut;
}

export function linkifyAnswerText(text: string): string {
  // Source: appendix:N:N → Appendix N link (before generic verse pattern)
  text = text.replace(/Source: appendix:(\d+):\d+/g, (_, num) =>
    `Source: [Appendix ${num}](https://wikisubmission.org/appendix/${num})`
  );

  // Source: qurantalk:Title → qurantalk link
  text = text.replace(/Source: qurantalk:(.+?)(?=\n|$)/gm, (_, title) => {
    const slug = title.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    return `Source: [${title.trim()}](https://www.qurantalk.com/${slug})`;
  });

  // Source: N:N(-N)? → verse link
  text = text.replace(/Source: (\d+):(\d+)(?:-\d+)?/g, (_, chapter, verse) =>
    `Source: [${chapter}:${verse}](https://wikisubmission.org/quran/${chapter}?verse=${verse})`
  );

  // [N:N] bracketed verse references in prose
  text = text.replace(/\[(\d+):(\d+)\]/g, (_, chapter, verse) =>
    `[${chapter}:${verse}](https://wikisubmission.org/quran/${chapter}?verse=${verse})`
  );

  return text;
}

export function buildAskMessages(question: string, data: SubmitterAIResponse): string[] {
  const allSources = data.sources || [];
  const verseSources = allSources.filter(isVerseSource);
  const otherCount = allSources.length - verseSources.length;

  let sourcesLine = "";
  if (verseSources.length > 0) {
    const verseList = verseSources.join(", ");
    const verseQuery = verseSources.join(",");
    sourcesLine = `[${verseList}](https://wikisubmission.org/quran/?q=${encodeURIComponent(verseQuery)})`;
    if (otherCount > 0) sourcesLine += ` and ${otherCount} more...`;
  } else if (otherCount > 0) {
    sourcesLine = `${otherCount} source${otherCount > 1 ? "s" : ""}`;
  }

  const LIMIT = 2000;
  const header = `## Q: ${question}\n▬▬▬▬▬▬▬▬▬▬\n`;
  const suffix =
    (sourcesLine ? `\n\n-# Sources: ${sourcesLine}` : "") +
    `\n-# **SubmitterAI** • \`/ask\`\n-# Answer may contain inaccuracies. Please verify all information.`;

  const fullAnswer = linkifyAnswerText(data.answer || "No answer returned.");

  const messages: string[] = [];
  let remaining = fullAnswer;

  while (remaining.length > 0 || messages.length === 0) {
    const prefix = messages.length === 0 ? header : "";
    const maxForMessage = LIMIT - prefix.length;
    const maxLastChunk = Math.max(0, maxForMessage - suffix.length);

    if (remaining.length <= maxLastChunk) {
      messages.push((prefix + remaining + suffix).substring(0, LIMIT));
      break;
    } else if (remaining.length === 0) {
      messages.push((prefix + suffix).substring(0, LIMIT));
      break;
    } else {
      const fullCut = safeCutPoint(remaining, maxForMessage);
      const cut =
        fullCut >= remaining.length && maxLastChunk > 0
          ? Math.max(1, safeCutPoint(remaining, maxLastChunk))
          : Math.max(1, fullCut);
      messages.push(prefix + remaining.substring(0, cut));
      remaining = remaining.substring(cut);
    }
  }

  return messages;
}

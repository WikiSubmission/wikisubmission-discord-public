import { ApplicationCommandOptionType } from "discord.js";
import { WSlashCommand } from "../types/w-slash-command";
import { logError } from "../utils/log-error";

interface SubmitterAIResponse {
  answer: string;
  sources: string[];
}

function isVerseSource(source: string): boolean {
  return /^\d+:\d+$/.test(source);
}

function linkifyAnswerText(text: string): string {
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

export default function command(): WSlashCommand {
  return {
    name: "ask",
    description: "Ask SubmitterAI a question about the Quran and related topics",
    options: [
      {
        name: "question",
        description: "Your question",
        type: ApplicationCommandOptionType.String,
        max_length: 500,
        required: true,
      },
    ],
    execute: async (interaction) => {
      const question = interaction.options.get("question", true).value as string;

      try {
        await interaction.deferReply();

        const apiKey = process.env.SUBMITTERAI_API_KEY;
        const apiUrl = process.env.SUBMITTERAI_API_URL;
        if (!apiKey) throw new Error("SUBMITTERAI_API_KEY is not configured");
        if (!apiUrl) throw new Error("SUBMITTERAI_API_URL is not configured");

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ question }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data: SubmitterAIResponse = await response.json();

        const allSources = data.sources || [];
        const verseSources = allSources.filter(isVerseSource);
        const otherCount = allSources.length - verseSources.length;

        let sourcesLine = "";
        if (verseSources.length > 0) {
          const verseLinks = verseSources
            .map((s) => {
              const [chapter, verse] = s.split(":");
              return `[${s}](https://wikisubmission.org/quran/${chapter}?verse=${verse})`;
            })
            .join(" ");
          sourcesLine = verseLinks;
          if (otherCount > 0) sourcesLine += ` and ${otherCount} more...`;
        } else if (otherCount > 0) {
          sourcesLine = `${otherCount} source${otherCount > 1 ? "s" : ""}`;
        }

        const LIMIT = 2000;
        const header = `## Q: ${question}\n▬▬▬▬▬▬▬▬▬▬\n`;
        const suffix = (sourcesLine ? `\n\n-# Sources: ${sourcesLine}` : "") +
          `\n-# **SubmitterAI** • \`/ask\`\n-# Answer may contain inaccuracies. Please verify all information.`;

        const fullAnswer = linkifyAnswerText(data.answer || "No answer returned.");

        // Greedily split into messages; suffix only appended to last message
        const messages: string[] = [];
        let remaining = fullAnswer;

        while (remaining.length > 0 || messages.length === 0) {
          const prefix = messages.length === 0 ? header : "";
          const maxForMessage = LIMIT - prefix.length;
          const maxLastChunk = Math.max(0, maxForMessage - suffix.length);

          if (remaining.length <= maxLastChunk) {
            // Remaining fits alongside suffix — this is the last message
            messages.push((prefix + remaining + suffix).substring(0, LIMIT));
            break;
          } else if (remaining.length === 0) {
            // No answer content but still need at least one message
            messages.push((prefix + suffix).substring(0, LIMIT));
            break;
          } else {
            messages.push(prefix + remaining.substring(0, maxForMessage));
            remaining = remaining.substring(maxForMessage);
          }
        }

        const safe = (s: string) => s.length > 2000 ? s.substring(0, 1997) + "…" : s;
        await interaction.editReply({ content: safe(messages[0]) });
        for (let i = 1; i < messages.length; i++) {
          await interaction.followUp({ content: safe(messages[i]) });
        }
      } catch (error: any) {
        logError(error, `(/ask)`);

        const errorMessage = (error.message || "Internal Server Error").substring(0, 1900);

        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
              content: `\`${errorMessage}\``,
              embeds: [],
              components: [],
            });
          } else {
            await interaction.reply({
              content: `\`${errorMessage}\``,
              flags: ["Ephemeral"],
            });
          }

          setTimeout(() => {
            interaction.deleteReply().catch(() => {});
          }, 3000);
        } catch (editError) {
          logError(editError, "Failed to send error reply");
        }
      }
    },
  };
}

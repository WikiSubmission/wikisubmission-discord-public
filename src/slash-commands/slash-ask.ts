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

        const answerText = linkifyAnswerText(data.answer?.substring(0, 1900) || "No answer returned.");
        const footer = `\n-# **SubmitterAI** • \`/ask\`\n-# Answer may contain inaccuracies. Please verify all information.`;
        const content = [
          `## Q: ${question}`,
          `▬▬▬▬▬▬▬▬▬▬`,
          answerText,
          sourcesLine ? `\n-# Sources: ${sourcesLine}` : "",
          footer,
        ]
          .filter(Boolean)
          .join("\n");

        await interaction.editReply({ content });
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

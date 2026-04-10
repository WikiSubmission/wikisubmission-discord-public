import { ApplicationCommandOptionType, EmbedBuilder } from "discord.js";
import { WSlashCommand } from "../types/w-slash-command";
import { wsApi } from "../utils/ws-api";

export default function command(): WSlashCommand {
  return {
    name: "word-by-word",
    description: "Get a word by word breakdown for any verse(s)",
    options: [
      {
        name: "verse",
        description: "Verse #:# (or #:#-#)",
        required: true,
        type: ApplicationCommandOptionType.String,
        name_localizations: {
          tr: "ayet",
        },
        description_localizations: {
          tr: "Ayet numarasını girin",
        },
      },
    ],
    execute: async (interaction) => {
      const query = `${interaction.options.get("verse")?.value?.toString() || "1:1"}`;

      if (query.includes("-") || !query.includes(":")) {
        await interaction.reply({
          content: `\`Please request only one verse at a time.\``,
          flags: ["Ephemeral"],
        });
        return;
      }

      try {
        const response = await wsApi.getQuran({
          verses: query,
          langs: ["en"],
          word_langs: ["ar", "tl"],
          include_words: true,
          include_root: true,
          include_meaning: true,
        });

        const words = response.chapters?.[0]?.verses?.[0]?.w ?? [];

        if (words.length === 0) {
          await interaction.reply({
            content: `\`No word data found for verse '${query}'\``,
            flags: ["Ephemeral"],
          });
          return;
        }

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${query} – Word by Word`)
              .setDescription(
                words
                  .map(
                    (w) =>
                      `**${w.tx?.["tl"] ?? ""} (${w.tx?.["ar"] ?? ""}) (${w.r ?? ""})**\n\`${w.m ?? ""}\``
                  )
                  .join("\n\n")
                  .substring(0, 4000)
              )
              .setFooter({
                text: `Quran: The Final Testament`,
              })
              .setColor("DarkButNotBlack"),
          ],
        });
      } catch (error: any) {
        await interaction.reply({
          content: `\`${error.message || "Failed to fetch word data"}\``,
          flags: ["Ephemeral"],
        });
      }
    },
  };
}

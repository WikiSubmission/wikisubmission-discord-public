import { ApplicationCommandOptionType, EmbedBuilder } from "discord.js";
import { WSlashCommand } from "../types/w-slash-command";

export default function command(): WSlashCommand {
  return {
    name: "bible",
    description: "Load a verse from the Bible",
    options: [
      {
        name: "verse",
        description: "Verse reference (e.g., John 3:16, Genesis 1:1-3)",
        required: true,
        type: ApplicationCommandOptionType.String,
      },
      {
        name: "translation",
        description: "Choose a specific translation",
        type: ApplicationCommandOptionType.String,
        choices: [
          {
            name: "ASV – American Standard Version",
            value: "asv",
          },
          {
            name: "BBE – Bible in Basic English",
            value: "bbe",
          },
          {
            name: "KJV – King James Version",
            value: "kjv",
          },
          {
            name: "WEB – World English Bible",
            value: "web",
          },
        ],
      },
    ],
    execute: async (interaction) => {
      const verse = interaction.options.get("verse", true).value as string;
      const translation =
        (interaction.options.get("translation")?.value as string | undefined) ||
        "asv";

      try {
        const response = await fetch(
          `https://bible-api.com/${encodeURIComponent(verse)}?translation=${translation}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch Bible verse");
        }

        const data = await response.json();

        let formattedText = data.text;
        if (data.verses && data.verses.length > 1) {
          formattedText = data.verses
            .filter((i: { text: string }) => i.text !== "\n")
            .map(
              (verse: { verse: string; text: string }) =>
                `**[${verse.verse}]** ${verse.text}`
            )
            .join("\n\n");
        }

        const embed = new EmbedBuilder()
          .setColor("DarkButNotBlack")
          .setTitle(`${data.reference}`)
          .setDescription(formattedText.replace(/[`]/g, "'").substring(0, 4000))
          .setFooter({
            text: `Bible • ${data.translation_name}${data?.verses?.[0]?.book_name ? ` • ${data.verses[0].book_name}` : ""}`,
          });

        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        await interaction.reply({
          content: `\`Verse '${verse}' not found\``,
          flags: ["Ephemeral"],
        });
      }
    },
  };
}

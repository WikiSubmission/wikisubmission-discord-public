import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ButtonBuilder,
  EmbedBuilder,
} from "discord.js";
import { WSlashCommand } from "../types/w-slash-command";
import { wsApi } from "../utils/ws-api";
import { cachePageData } from "../utils/cache-interaction";
import type { components } from "../api/types.gen";

const FOOTER = "Quran: The Final Testament";
const MAX_EMBED_DESCRIPTION_LENGTH = 4000;
type WordData = components["schemas"]["WordData"];

function formatWord(word: WordData, includeMeanings: boolean): string {
  const transliteration = word.tx?.["tl"]?.trim() ?? "";
  const arabic = word.tx?.["ar"]?.trim() ?? "";
  const english = word.tx?.["en"]?.trim();
  const root = word.r?.trim();
  const meaning = word.m?.trim();

  const headingParts = [
    transliteration || english || arabic || `Word ${word.wi ?? ""}`.trim(),
    arabic ? `(${arabic})` : "",
    root ? `(${root})` : "",
  ].filter(Boolean);

  return [
    `**${headingParts.join(" ")}**`,
    english,
    includeMeanings && meaning ? meaning : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function splitRowsToPages(
  rows: string[],
  maxChunkLength: number = MAX_EMBED_DESCRIPTION_LENGTH
): string[] {
  const pages: string[] = [];
  let currentPage = "";

  for (const row of rows) {
    const rowWithSeparator = currentPage.length > 0 ? `\n\n${row}` : row;

    if (currentPage.length + rowWithSeparator.length > maxChunkLength) {
      if (currentPage.length > 0) {
        pages.push(currentPage.trim());
      }

      currentPage = row;
    } else {
      currentPage += rowWithSeparator;
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage.trim());
  }

  return pages;
}

export default function command(): WSlashCommand {
  return {
    name: "word-by-word",
    description: "Get a word by word breakdown for any verse(s)",
    options: [
      {
        name: "verse",
        description: "Verse #:#",
        required: true,
        type: ApplicationCommandOptionType.String,
        name_localizations: {
          tr: "ayet",
        },
        description_localizations: {
          tr: "Ayet numarasını girin",
        },
      },
      {
        name: "with-meanings",
        description: "Include detailed word meanings?",
        required: false,
        type: ApplicationCommandOptionType.Boolean,
      },
    ],
    execute: async (interaction) => {
      const query = `${interaction.options.get("verse")?.value?.toString() || "1:1"}`.trim();
      const includeMeanings =
        interaction.options.get("with-meanings")?.value === true;

      if (!/^\d{1,3}:\d{1,3}$/.test(query)) {
        await interaction.reply({
          content: `\`Please request only one verse at a time.\``,
          flags: ["Ephemeral"],
        });
        return;
      }

      try {
        const response = await wsApi.getQuran({
          verses: query,
          langs: ["en", "ar", "tl"],
          word_langs: ["ar", "tl", "en"],
          include_words: true,
          include_root: true,
          include_meaning: includeMeanings || undefined,
        });

        const words = response.chapters?.[0]?.verses?.[0]?.w ?? [];

        if (words.length === 0) {
          await interaction.reply({
            content: `\`No word data found for verse '${query}'\``,
            flags: ["Ephemeral"],
          });
          return;
        }

        const title = `${query} – Word by Word`;
        const pages = splitRowsToPages(
          words.map((word) => formatWord(word, includeMeanings))
        );

        if (pages.length > 1) {
          await cachePageData(interaction.id, {
            user_id: interaction.user.id,
            title,
            footer: FOOTER,
            total_pages: pages.length,
            content: pages,
          });
        }

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(title)
              .setDescription(pages[0])
              .setFooter({
                text: `${FOOTER}${pages.length > 1 ? ` • Page 1/${pages.length}` : ""}`,
              })
              .setColor("DarkButNotBlack"),
          ],
          components:
            pages.length > 1
              ? [
                  new ActionRowBuilder<any>().setComponents(
                    new ButtonBuilder()
                      .setLabel("Next page")
                      .setCustomId("page_2")
                      .setStyle(1)
                  ),
                ]
              : [],
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

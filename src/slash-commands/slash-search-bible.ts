import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
} from "discord.js";
import { WSlashCommand } from "../types/w-slash-command";
import { wsApi } from "../utils/ws-api";
import { cachePageData } from "../utils/cache-interaction";
import { logError } from "../utils/log-error";

export default function command(): WSlashCommand {
  return {
    name: "search-bible",
    description: "Search the Bible",
    options: [
      {
        name: "query",
        description: "Search query",
        required: true,
        type: ApplicationCommandOptionType.String,
      },
    ],
    execute: async (interaction) => {
      const query = interaction.options.get("query", true).value as string;

      try {
        await interaction.deferReply();

        const response = await wsApi.searchBible({
          q: query,
          langs: ["en"],
          limit: 20,
        });

        const total = response.info?.total ?? 0;
        const books = response.books ?? [];

        if (books.length === 0) {
          await interaction.editReply({
            content: `\`No results found for '${query}'\``,
          });
          return;
        }

        // Flatten: book → chapter → verse
        const lines: string[] = books.flatMap((bk) =>
          (bk.chapters ?? []).flatMap((ch) =>
            (ch.verses ?? []).map((v) => {
              const raw = v.tr?.["en"]?.hl ?? v.tr?.["en"]?.tx ?? "";
              const text = raw.replace(/<b>(.*?)<\/b>/g, "**$1**");
              return `**[${bk.bk} ${ch.cn}:${v.vn}]** ${text}`;
            })
          )
        );

        // Split into pages
        const pages = splitToPages(lines);
        const title = `${query} – Bible Search`;
        const footer = "Bible • Search";

        if (pages.length > 1) {
          await cachePageData(interaction.id, {
            user_id: interaction.user.id,
            title,
            footer,
            total_pages: pages.length,
            content: pages,
          });
        }

        const pageDescription = pages[0];
        const truncated =
          pageDescription.length > 4096
            ? pageDescription.substring(0, 4093)
            : pageDescription;

        await interaction.editReply({
          content: `Found **${total}** result${total !== 1 ? "s" : ""} for \`${query}\``,
          embeds: [
            new EmbedBuilder()
              .setTitle(title.substring(0, 256))
              .setDescription(truncated)
              .setFooter({
                text: `${footer}${pages.length > 1 ? ` • Page 1/${pages.length}` : ""}`,
              })
              .setColor("DarkButNotBlack"),
          ],
          components:
            pages.length > 1
              ? [
                  new ActionRowBuilder<any>().setComponents(
                    new ButtonBuilder()
                      .setLabel("Next page")
                      .setCustomId(`page_2`)
                      .setStyle(1)
                  ),
                ]
              : [],
        });
      } catch (error: any) {
        logError(error, `(/search-bible)`);
        const errorMsg = `\`${error.message || "Internal Server Error"}\``;
        try {
          if (interaction.deferred) {
            await interaction.editReply({ content: errorMsg });
            setTimeout(() => interaction.deleteReply().catch(() => {}), 3000);
          } else {
            await interaction.reply({ content: errorMsg, flags: ["Ephemeral"] });
          }
        } catch {
          // silently ignore — interaction may have expired
        }
      }
    },
  };
}

function splitToPages(
  lines: string[],
  maxChunkLength = 4000
): string[] {
  const pages: string[] = [];
  let current = "";

  for (const line of lines) {
    const separator = current.length > 0 ? "\n\n" : "";
    if (current.length + separator.length + line.length > maxChunkLength) {
      if (current.length > 0) pages.push(current.trim());
      current = line;
    } else {
      current += separator + line;
    }
  }

  if (current.length > 0) pages.push(current.trim());
  return pages;
}

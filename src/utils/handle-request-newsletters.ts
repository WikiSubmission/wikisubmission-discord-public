import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from "discord.js";
import { DiscordRequest } from "./handle-request";
import { WDiscordCommandResult } from "../types/w-discord-command-result";
import { cachePageData } from "./cache-interaction";
import { logError } from "./log-error";
import { ws } from "./wikisubmission-sdk";

export class HandleNewslettersRequest extends DiscordRequest {
  constructor(
    interaction: any,
    public page: number = 1
  ) {
    super(interaction);
  }

  async getResultsAndReply(): Promise<void> {
    try {
      // Defer the reply to prevent interaction timeout
      await this.interaction.deferReply();

      const { embeds, components, content } = await this.getResults();
      await this.interaction.editReply({
        content,
        embeds,
        components,
      });
    } catch (error: any) {
      logError(error, `(/${this.interaction.commandName})`);
      try {
        await this.interaction.editReply({
          content: `\`${error.message || "Internal Server Error"}\``,
        });
      } catch (editError) {
        // If edit fails, try to reply instead
        await this.interaction.followUp({
          content: `\`${error.message || "Internal Server Error"}\``,
          flags: ["Ephemeral"],
        });
      }
    }
  }

  async getResults(): Promise<WDiscordCommandResult> {
    const query = this.getStringInput("query");

    if (!query) throw new Error(`Missing query`);

    const results = await ws.Newsletters.query(query, {
      highlight: true,
      strategy:
        this.getStringInput("strict-search") === "yes" ? "strict" : "default",
    });

    if (results.data) {
      const title = `${query} - Newsletter Search`;
      const pages = this._splitToChunks(
        results.data
          .map(
            (i) =>
              `[${i.year} ${capitalize(i.month)}, page ${
                i.page
              }](https://www.masjidtucson.org/publications/books/sp/${
                i.year
              }/${i.month}/page${i.page}.html) - ${i.content}`
          )
          .join("\n\n")
      );
      const footer = "Newsletters • Search 🔎";

      // Multi-page? Cache paginated data.
      if (pages.length > 1) {
        await cachePageData(this.interaction.id, {
          user_id: this.interaction.user.id,
          title: title,
          footer: footer,
          total_pages: pages.length,
          content: pages,
        });
      }

      if (this.page > pages.length) {
        throw new Error(`You've reached the last page`);
      }

      if (this.page <= 0) {
        throw new Error(`You're on the first page`);
      }

      // Ensure description doesn't exceed Discord's limit
      const pageDescription = pages[this.page - 1];
      const truncatedDescription =
        pageDescription.length > 4096
          ? pageDescription.substring(0, 4093) + ""
          : pageDescription;

      return {
        content: this.isSearchRequest()
          ? `Found **${results.data.length}** newsletter instances with \`${query}\``
          : undefined,
        embeds: [
          new EmbedBuilder()
            .setTitle(title)
            .setDescription(truncatedDescription)
            .setFooter({
              text: `${footer}${
                pages.length > 1 ? ` • Page ${this.page}/${pages.length}` : ``
              }`,
            })
            .setColor("DarkButNotBlack"),
        ],
        components:
          pages.length > 1
            ? [
                new ActionRowBuilder<any>().setComponents(
                  ...(this.page > 1
                    ? [
                        new ButtonBuilder()
                          .setLabel("Previous page")
                          .setCustomId(`page_${this.page - 1}`)
                          .setStyle(2),
                      ]
                    : []),

                  ...(this.page !== pages.length
                    ? [
                        new ButtonBuilder()
                          .setLabel("Next page")
                          .setCustomId(`page_${this.page + 1}`)
                          .setStyle(1),
                      ]
                    : [])
                ),
              ]
            : [],
      };
    } else {
      throw new Error(
        `${results.error.message || `No newsletter instances found with "${query}"`}`
      );
    }
  }
}

function capitalize(input: string | undefined | null): string {
  if (!input) return "";
  if (input.length === 0) return "";
  return input.charAt(0).toUpperCase() + input.slice(1);
}

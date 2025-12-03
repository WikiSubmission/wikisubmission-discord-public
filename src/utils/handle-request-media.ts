import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from "discord.js";
import { DiscordRequest } from "./handle-request";
import { WDiscordCommandResult } from "../types/w-discord-command-result";
import { cachePageData } from "./cache-interaction";
import { logError } from "./log-error";
import { ws } from "./wikisubmission-sdk";

export class HandleMediaRequest extends DiscordRequest {
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
        // Delete error message after 3 seconds
        setTimeout(() => {
          this.interaction.deleteReply().catch(() => {});
        }, 3000);
      } catch (editError) {
        // If edit fails, try to reply instead
        const followUpMessage = await this.interaction.followUp({
          content: `\`${error.message || "Internal Server Error"}\``,
          ephemeral: true,
        });
        // Delete error message after 3 seconds
        setTimeout(() => {
          followUpMessage.delete().catch(() => {});
        }, 3000);
      }
    }
  }

  async getResults(): Promise<WDiscordCommandResult> {
    const query = this.getStringInput("query");

    if (!query) throw new Error(`Missing query`);

    const results = await ws.Media.query(query, {
      highlight: true,
      strategy:
        this.getStringInput("strict-search") === "yes" ? "strict" : "default",
      category: ws.Media.Methods.parseCategory(
        this.getStringInput("specific-category")
      ),
    });

    if (results.data) {
      if (results.data.length === 0) {
        throw new Error(`No media instances found with '${query}'`);
      }

      // Apply 350 hard limit
      const limitedData = results.data.slice(0, 350);
      const originalCount = results.data.length;

      const title = `${query} - Media Search`;
      const pages = this._splitToChunks(
        limitedData
          .map(
            (i) =>
              `[${i.title} @ ${i.start_timestamp}](https://youtu.be/${i.youtube_id}?t=${i.youtube_timestamp}) - ${i.transcript}`
          )
          .join("\n\n")
      );
      const footer =
        "Media • Search 🔎 • Verify all information. Transcripts derived using AI transcription on the original content.";

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
          ? `Found **${originalCount > 348 ? "350+" : originalCount}** media instance${originalCount > 1 ? "s" : ""} with \`${query}\``
          : undefined,
        embeds: [
          new EmbedBuilder()
            .setTitle(title.slice(0, 256))
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
      throw new Error(`${results.error.message}`);
    }
  }
}

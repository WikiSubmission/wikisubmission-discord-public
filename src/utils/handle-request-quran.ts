import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from "discord.js";
import { WDiscordCommandResult } from "../types/w-discord-command-result";
import { DiscordRequest } from "./handle-request";
import { cachePageData } from "./cache-interaction";
import { logError } from "./log-error";
import { wsApi, mapLangCodes } from "./ws-api";

/** Convert API highlight tags (<b>word</b>) to Discord markdown bold (**word**). */
function hlToMd(text: string): string {
  return text.replace(/<b>(.*?)<\/b>/g, "**$1**");
}

export class HandleQuranRequest extends DiscordRequest {
  constructor(
    public interaction: any,
    public page: number = 1,
    public options?: {
      footnoteOnly?: boolean;
    }
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

      const errorMessage = (error.message || "Internal Server Error").substring(
        0,
        1900
      );

      try {
        if (this.interaction.deferred || this.interaction.replied) {
          await this.interaction.editReply({
            content: `\`${errorMessage}\``,
            embeds: [],
            components: [],
          });
        } else {
          await this.interaction.reply({
            content: `\`${errorMessage}\``,
            ephemeral: true,
          });
        }

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
    const cmdName = this.interaction.commandName as string;
    const isSearch = cmdName.startsWith("search");
    const isChapter = cmdName === "chapter" || cmdName === "footnote";

    const query = isChapter
      ? this.getStringInput("chapter")
      : isSearch
        ? this.getStringInput("query")
        : this.getStringInput("verse");

    if (!query) throw new Error(`Missing query`);

    const withTranslit = this.getStringInput("with-transliteration") === "yes";
    const targetLang = this.targetLanguage();
    const langs = mapLangCodes(targetLang, withTranslit);
    const primaryLang = langs[0];

    const includeCommentary = this.getStringInput("no-commentary") !== "yes";
    const footnoteOnly = this.options?.footnoteOnly ?? false;

    // --- Call the appropriate endpoint ---
    let response;
    let totalMatches = 0;

    if (isSearch) {
      response = await wsApi.searchQuran({
        q: query,
        langs,
        limit: 100,
      });
      totalMatches = response.info?.total ?? 0;
    } else if (isChapter) {
      // query is a chapter number (e.g. "1" or "18")
      const chNum = parseInt(query, 10);
      if (isNaN(chNum) || chNum < 1 || chNum > 114) {
        throw new Error(`Invalid chapter number '${query}'`);
      }
      response = await wsApi.getQuran({
        chapter_number_start: chNum,
        chapter_number_end: chNum,
        langs,
      });
    } else {
      response = await wsApi.getQuran({
        verses: query,
        langs,
      });
    }

    const chapters = response.chapters ?? [];
    if (chapters.length === 0) {
      throw new Error(`No verse(s) found with '${query}'`);
    }

    // --- Title & footer ---
    const firstChapter = chapters[0];
    const chNum = firstChapter.cn ?? 0;
    const chTitle =
      firstChapter.titles?.[primaryLang] ?? firstChapter.titles?.["en"] ?? "";
    const title = chapters.length === 1 ? `Sura ${chNum}, ${chTitle}` : `Quran`;
    const footer = "Quran: The Final Testament";

    // --- Build verse content strings ---
    const verses: string[] = [];

    if (isSearch) {
      for (const chapter of chapters) {
        for (const verse of chapter.verses ?? []) {
          const tr = verse.tr ?? {};
          const raw = tr[primaryLang]?.hl ?? tr[primaryLang]?.tx ?? "";
          verses.push(`**[${verse.vk}]** ${hlToMd(raw)}`);
        }
      }
    } else {
      for (const chapter of chapters) {
        for (const result of (chapter.verses ?? []).slice(0, 350)) {
          const tr = result.tr ?? {};
          const translation = tr[primaryLang];
          let verseContent = "";

          // [Subtitle]
          if (translation?.s && includeCommentary && !footnoteOnly) {
            verseContent += `\`${translation.s}\`\n\n`;
          }

          // [Text]
          if (!footnoteOnly) {
            verseContent += `**[${result.vk}]** ${translation?.tx ?? ""}\n\n`;
          }

          // [Arabic] (equran: English + Arabic)
          if (targetLang === "englishAndArabic" && !footnoteOnly) {
            const arabicTr = tr["ar"];
            verseContent += `**[${result.vk}]** ${arabicTr?.tx ?? ""}\n\n`;
          }

          // [Transliteration]
          if (withTranslit) {
            const translitTr = tr["tl"];
            verseContent += `${translitTr?.tx ?? ""}\n\n`;
          }

          // [Footnote]
          if (translation?.f && (includeCommentary || footnoteOnly)) {
            verseContent += `*${translation.f}*\n\n`;
          }

          verses.push(verseContent.trim());
        }
      }
    }

    if (verses.length === 0) {
      throw new Error(`No verse(s) found with '${query}'`);
    }

    // Split verses into pages that fit within Discord embed limit
    const pages = this.splitVersesToPages(verses);

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

    // Validate page number
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
      content: isSearch
        ? `Found **${totalMatches > 348 ? "350+" : totalMatches}** verse${totalMatches > 1 ? "s" : ""} with \`${query}\`${isSearch && totalMatches > 10 ? `\n[Search on wikisubmission.org →](https://wikisubmission.org/quran?q=${encodeURIComponent(query)})` : ""}`
        : undefined,
      embeds: [
        new EmbedBuilder()
          .setTitle(title.substring(0, 256))
          .setDescription(truncatedDescription)
          .setFooter({
            text: `${footer}${pages.length > 1 ? ` • Page ${this.page}/${pages.length}` : ``}`,
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
  }

  // Helper methods.

  private splitVersesToPages(
    verses: string[],
    maxChunkLength: number = 4000
  ): string[] {
    const pages: string[] = [];
    let currentPage = "";

    for (let i = 0; i < verses.length; i++) {
      const verse = verses[i];
      const verseWithSeparator =
        currentPage.length > 0 ? "\n\n" + verse : verse;
      const currentPageLength = currentPage.length + verseWithSeparator.length;

      if (currentPageLength > maxChunkLength) {
        if (currentPage.length > 0) {
          pages.push(currentPage.trim());
          currentPage = verse;
        } else {
          // If a single verse is too long, include it anyway
          pages.push(verse);
        }
      } else {
        currentPage += verseWithSeparator;
      }
    }

    if (currentPage.length > 0) {
      pages.push(currentPage.trim());
    }

    return pages;
  }
}

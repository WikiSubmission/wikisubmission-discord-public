import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from "discord.js";
import { WDiscordCommandResult } from "../types/w-discord-command-result";
import { DiscordRequest } from "./handle-request";
import { cachePageData } from "./cache-interaction";
import { logError } from "./log-error";
import { ws } from "./wikisubmission-sdk";

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
      try {
        await this.interaction.editReply({
          content: `\`${error.message || "Internal Server Error"}\``,
        });
        // Delete error message after 3 seconds
        setTimeout(() => {
          this.interaction.deleteReply().catch(() => { });
        }, 3000);
      } catch (editError) {
        // If edit fails, try to reply instead
        const followUpMessage = await this.interaction.followUp({
          content: `\`${error.message || "Internal Server Error"}\``,
          ephemeral: true,
        });
        // Delete error message after 3 seconds
        setTimeout(() => {
          followUpMessage.delete().catch(() => { });
        }, 3000);
      }
    }
  }

  async getResults(): Promise<WDiscordCommandResult> {
    const query =
      this.interaction.commandName === "chapter"
        ? this.getStringInput("chapter") // "/chapter"
        : this.interaction.commandName.startsWith("search")
          ? this.getStringInput("query") // "/search-quran"
          : this.getStringInput("verse"); // "/quran, /equran, etc"

    if (!query) throw new Error(`Missing query`);

    const language = ws.Quran.Methods.parseLanguage(this.targetLanguage());
    const includeCommentary = this.getStringInput("no-commentary") !== "yes";

    var title = "";
    var verses: string[] = [];
    var footer = "";

    const results = await ws.Quran.query(query, {
      highlight: true,
      language: language,
      strategy:
        this.getStringInput("strict-search") === "yes" ? "strict" : "default",
      adjustments: {
        index: true,
        chapters: true,
        text: true,
        footnotes: this.getStringInput("no-commentary") !== "yes",
        subtitles: this.getStringInput("no-commentary") !== "yes",
        wordByWord: false,
      },
      normalizeGodCasing: true
    });

    if (results.status === "success") {
      // [Use result metadata for title + footer]
      title = results.metadata.formattedChapterTitle;
      footer = results.metadata.formattedBookTitle;

      // [Build description baesd on result.type]
      switch (results.type) {
        case "verse":
        case "multiple_verses":
        case "chapter": {
          for (const result of results.data.slice(0, 350)) {
            let verseContent = "";

            // [Subtitles]
            if (
              result.ws_quran_subtitles &&
              includeCommentary &&
              !this.options?.footnoteOnly
            ) {
              const subtitleText =
                result.ws_quran_subtitles[
                language in result.ws_quran_subtitles
                  ? (language as keyof typeof result.ws_quran_subtitles)
                  : "english"
                ];
              verseContent += `\`${String(subtitleText)}\`\n\n`;
            }

            // [Text]
            if (!this.options?.footnoteOnly) {
              verseContent += `**[${result.verse_id}]** ${result.ws_quran_text[language]}\n\n`;
            }

            // [Arabic]
            if (
              this.interaction.commandName === "equran" &&
              !this.options?.footnoteOnly
            ) {
              const arabicText = result.ws_quran_text.arabic;
              verseContent += `**[${result.verse_id_arabic}]** ${arabicText}\n\n`;
            }

            // [Footnotes]
            if (
              result.ws_quran_footnotes &&
              (includeCommentary || this.options?.footnoteOnly)
            ) {
              const footnoteText =
                result.ws_quran_footnotes[
                language in result.ws_quran_footnotes
                  ? (language as keyof typeof result.ws_quran_footnotes)
                  : "english"
                ];
              verseContent += `*${String(footnoteText)}*\n\n`;
            }

            verses.push(verseContent.trim());
          }
          break;
        }

        case "search": {
          for (const result of results.data.slice(0, 350)) {
            let verseContent = "";
            switch (result.hit) {
              case "text":
                const textContent = result[language];
                verseContent = `**[${result.verse_id}]** ${textContent}`;
                break;
              case "chapter":
                const chapterTitle = result[`title_${language}`];
                verseContent = `**Chapter:** Sura ${result.chapter_number}, ${chapterTitle}`;
                break;
              case "subtitle":
                const subtitleContent =
                  result[
                  language in result
                    ? (language as keyof typeof result)
                    : "english"
                  ];
                verseContent = `**[${result.verse_id}]** Subtitle: ${String(subtitleContent)}`;
                break;
              case "footnote":
                const footnoteContent =
                  result[
                  language in result
                    ? (language as keyof typeof result)
                    : "english"
                  ];
                verseContent = `**[${result.verse_id}]** Footnote: *${String(footnoteContent)}*`;
                break;
            }
            verses.push(verseContent);
          }
          break;
        }
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
        content: this.isSearchRequest()
          ? `Found **${results.totalMatches > 348 ? "350+" : results.totalMatches}** verse${results.totalMatches > 1 ? "s" : ""} with \`${query}\`${results.type === "search" && results.totalMatches > 10 ? `\n[Search on wikisubmission.org →](https://wikisubmission.org/quran?q=${encodeURIComponent(query)})` : ''}`
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
    } else {
      throw new Error(`No verse(s) found with '${query}'`);
    }
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
          // If a single verse is too long, we have to include it anyway
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

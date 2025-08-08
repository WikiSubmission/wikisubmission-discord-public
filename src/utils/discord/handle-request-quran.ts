import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { WDiscordCommandResult } from '../../types/w-discord-command-result';
import { DiscordRequest } from './handle-request';
import { getSupabaseClient } from '../get-supabase-client';
import { serializedInteraction } from './serialized-interaction';
import { WikiSubmission } from 'wikisubmission-sdk';
import { logError } from '../log-error';

export class HandleQuranRequest extends DiscordRequest {
  constructor(
    public interaction: any,
    public page: number = 1,
    public options?: {
      footnoteOnly?: boolean;
    },
  ) {
    super(interaction);
  }

  async getResultsAndReply(): Promise<void> {
    try {
      const { embeds, components, content } = await this.getResults();
      await this.interaction.reply({
        content,
        embeds,
        components,
      });
    } catch (error: any) {
      logError(error, `(/${this.interaction.commandName})`);
      await this.interaction.reply({
        content: `\`${error.message || 'Internal Server Error'}\``,
        flags: ['Ephemeral'],
      });
    }
  }

  async getResults(): Promise<WDiscordCommandResult> {
    const query =
      this.interaction.commandName === 'chapter'
        ? this.getStringInput('chapter') // "/chapter"
        : this.interaction.commandName.startsWith('search')
          ? this.getStringInput('query') // "/search-quran"
          : this.getStringInput('verse'); // "/quran, /equran, etc"

    if (!query) throw new Error(`Missing query`);

    const ws = WikiSubmission.Quran.V1.createAPIClient({
      enableRequestLogging: true
    });

    const language = WikiSubmission.Quran.V1.Methods.resolveLanguageQuery(this.targetLanguage())[0];

    const results = await ws.query(query, {
      search_apply_highlight: true,
      search_ignore_commentary: this.getStringInput('no-footnotes') === 'yes',
      search_language: language,
      search_strategy: this.getStringInput('strict-search') === 'yes' ? 'exact' : 'fuzzy',
      normalize_god_casing: true,
      include_language: [language]
    });

    if (results instanceof WikiSubmission.Error) {
      throw new Error(results.message);
    } else {
      const title = this.options?.footnoteOnly ? 'Footnote(s)' : this.interaction.commandName.startsWith('search') ? `${this.getStringInput('query') || '*'} - Quran Search` : WikiSubmission.Quran.V1.Methods.formatDataToChapterTitle(results.response, language);
      const verses = WikiSubmission.Quran.V1.Methods.formatDataToText(results.response, language, {
        includeMarkdownFormatting: true,
        includeArabic: (this.getStringInput('with-arabic') === 'yes' || this.interaction.commandName === 'equran' || this.interaction.commandName === 'aquran') && this.options?.footnoteOnly !== true,
        includeSubtitles: this.getStringInput('no-footnotes') !== 'yes' && this.options?.footnoteOnly !== true,
        includeFootnotes: this.getStringInput('no-footnotes') !== 'yes' || this.options?.footnoteOnly !== true,
        includeTransliteration: this.getStringInput('with-transliteration') === 'yes' && this.options?.footnoteOnly !== true,
        removeMainText: this.options?.footnoteOnly === true,
      });
      const footer = WikiSubmission.Quran.V1.Methods.getBookTitle(language);

      // Split verses into pages that fit within Discord embed limit
      const description = this._splitVersesToPages(verses);

      // Multi-page? Cache interaction.
      if (description.length > 1) {
        const db = getSupabaseClient();
        await db.from('GlobalCache').insert({
          key: this.interaction.id,
          value: JSON.stringify(serializedInteraction(this.interaction)),
        });
      }

      return {
        content: this.isSearchRequest()
          ? `Found **${results.response.length}** verses with \`${query}\``
          : undefined,
        embeds: [
          new EmbedBuilder()
            .setTitle(title)
            .setDescription(description[this.page - 1])
            .setFooter({
              text: `${footer}${description.length > 1 ? ` • Page ${this.page}/${description.length}` : ``}`,
            })
            .setColor('DarkButNotBlack'),
        ],
        components:
          description.length > 1
            ? [
              new ActionRowBuilder<any>().setComponents(
                ...(this.page > 1
                  ? [
                    new ButtonBuilder()
                      .setLabel('Previous page')
                      .setCustomId(`page_${this.page - 1}`)
                      .setStyle(2),
                  ]
                  : []),

                ...(this.page !== description.length
                  ? [
                    new ButtonBuilder()
                      .setLabel('Next page')
                      .setCustomId(`page_${this.page + 1}`)
                      .setStyle(1),
                  ]
                  : []),
              ),
            ]
            : [],
      };
    }
  }

  // Helper methods.

  private _splitVersesToPages(verses: string[], maxChunkLength: number = 4000): string[] {
    const pages: string[] = [];
    let currentPage = '';
    
    for (const verse of verses) {
      const currentPageLength = currentPage.length + verse.length + 2; // +2 for \n\n

      if (currentPageLength > maxChunkLength) {
        if (currentPage.length > 0) {
          pages.push(currentPage.trim());
          currentPage = verse;
        } else {
          // If a single verse is too long, we have to include it anyway
          pages.push(verse);
        }
      } else {
        currentPage += (currentPage.length > 0 ? '\n\n' : '') + verse;
      }
    }

    if (currentPage.length > 0) {
      pages.push(currentPage.trim());
    }

    return pages;
  }
}
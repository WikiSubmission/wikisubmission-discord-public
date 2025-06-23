import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { DiscordRequest } from './handle-request';
import { WDiscordCommandResult } from '../../types/w-discord-command-result';
import { Database } from '../../types/generated/database.types';
import { getSupabaseClient } from '../get-supabase-client';
import { serializedInteraction } from './serialized-interaction';
import { logError } from '../log-error';

export class HandleNewslettersRequest extends DiscordRequest {
  constructor(
    interaction: any,
    public page: number = 1,
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
    const query = this.getStringInput('query');

    if (!query) throw new Error(`Missing query`);

    const fetchURL = new URL(
      `https://api.wikisubmission.org/moc/newsletters/search`,
    );

    fetchURL.searchParams.append('q', query);
    fetchURL.searchParams.append('highlight', 'true');
    if (this.getStringInput('strict-search') !== 'yes') {
      fetchURL.searchParams.append('iwo', 'true');
    }

    const req = await fetch(fetchURL);

    const request: {
      results: Database['public']['Tables']['DataNewsletters']['Row'][];
      error: { name: string; description: string };
    } = await req.json();

    if (request?.results && !request.error) {
      const title = `${query} - Newsletter Search`;
      const description = this._splitToChunks(
        request.results
          .map(
            (i) =>
              `[${i.sp_year} ${capitalize(i.sp_month)}, page ${i.sp_page
              }](https://www.masjidtucson.org/publications/books/sp/${i.sp_year
              }/${i.sp_month}/page${i.sp_page}.html) - ${i.sp_content}`,
          )
          .join('\n\n'),
      );
      const footer = 'Newsletters • Search 🔎';

      // Multi-page? Cache interaction.
      if (description.length > 1) {
        const db = getSupabaseClient();
        await db.from('GlobalCache').insert({
          key: this.interaction.id,
          value: JSON.stringify(serializedInteraction(this.interaction)),
        });
      }

      if (this.page > description.length) {
        throw new Error(`You've reached the last page`);
      }

      if (this.page <= 0) {
        throw new Error(`You're on the first page`);
      }

      return {
        content: this.isSearchRequest()
          ? `Found **${request.results.length}** newsletter instances with \`${query}\``
          : undefined,
        embeds: [
          new EmbedBuilder()
            .setTitle(title)
            .setDescription(description[this.page - 1])
            .setFooter({
              text: `${footer}${description.length > 1
                  ? ` • Page ${this.page}/${description.length}`
                  : ``
                }`,
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
    } else {
      throw new Error(
        `${request?.error?.description ||
        `No newsletter instances found with "${query}"`
        }`,
      );
    }
  }
}

function capitalize(input: string | undefined | null): string {
  if (!input) return '';
  if (input.length === 0) return '';
  return input.charAt(0).toUpperCase() + input.slice(1);
}

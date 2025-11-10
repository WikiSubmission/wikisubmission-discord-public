import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import { WSlashCommand } from '../types/w-slash-command';
import { ws } from '../utils/wikisubmission-sdk';

export default function command(): WSlashCommand {
  return {
    name: 'word-by-word',
    description: 'Get a word by word breakdown for any verse(s)',
    options: [
      {
        name: 'verse',
        description: 'Verse #:# (or #:#-#)',
        required: true,
        type: ApplicationCommandOptionType.String,
        name_localizations: {
          tr: 'ayet',
        },
        description_localizations: {
          tr: 'Ayet numarasını girin',
        },
      },
    ],
    execute: async (interaction) => {
      const query = `${interaction.options.get('verse')?.value?.toString() || '1:1'}`;

      if (query.includes('-') || !query.includes(':')) {
        await interaction.reply({
          content: `\`Please request only one verse at a time.\``,
          flags: ['Ephemeral'],
        });
        return;
      }

      const request = await ws.supabase
        .from("ws_quran_word_by_word")
        .select("*")
        .eq("verse_id", query)

      if (request.error) {
        await interaction.reply({
          content: `\`${request.error}\``,
          flags: ['Ephemeral'],
        });
      } else {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${query} – Word by Word`)

              .setDescription(
                `${request.data.map((w) => `**${w.transliterated} (${w.arabic}) (${w.root_word})**\n\`${w.english}\``).join('\n\n')}`.substring(
                  0,
                  4000,
                ),
              )
              .setFooter({
                text: `Quran: The Final Testament`,
              })
              .setColor('DarkButNotBlack'),
          ],
        });
      }
    },
  };
}

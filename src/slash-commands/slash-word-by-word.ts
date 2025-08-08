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

      const request = await ws.query(query, {
        include_word_by_word: true,
      });

      if (request instanceof ws.Error) {
        await interaction.reply({
          content: `\`${request.message}\``,
          flags: ['Ephemeral'],
        });
      } else {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${query} – Word by Word`)

              .setDescription(
                `${request.response[0].word_by_word.map((w) => `**${w.transliterated_text} (${w.arabic_text}) (${w.root_word})**\n\`${w.english_text}\``).join('\n\n')}`.substring(
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

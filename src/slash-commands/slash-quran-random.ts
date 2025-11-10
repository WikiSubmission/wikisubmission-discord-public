import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import { WSlashCommand } from '../types/w-slash-command';
import { ws } from '../utils/wikisubmission-sdk';

export default function command(): WSlashCommand {
  return {
    name: 'random-verse',
    description: 'Get a random verse from the Quran',
    options: [
      {
        name: 'language',
        description: 'Choose another language',
        type: ApplicationCommandOptionType.String,
        choices: ['turkish'].map((i) => ({
          name: i,
          value: i,
        })),
        name_localizations: {
          tr: 'dil',
        },
        description_localizations: {
          tr: 'Farklı dil?',
        },
      },
    ],
    name_localizations: {
      tr: 'rastgele',
    },
    description_localizations: {
      tr: 'Rastgele ayet',
    },
    execute: async (interaction) => {

      const request = await ws.Quran.randomVerse();

      if (request.error) {
        await interaction.reply({
          content: `\`${request.error}\``,
          flags: ['Ephemeral'],
        });
      } else {
        let isTurkish =
          interaction.options.get('language')?.value === 'turkish' ||
          (interaction.locale === 'tr' && interaction.options.get('language')?.value !== 'english');

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                isTurkish
                  ? `Sure ${request.data.chapter_number}, ${request.data.ws_quran_chapters.title_turkish}`
                  : `Sura ${request.data.chapter_number}, ${request.data.ws_quran_chapters.title_english}`,
              )
              .setDescription(
                `**[${request.data.verse_id}]** ${request.data.ws_quran_text?.[isTurkish ? 'turkish' : 'english']
                }\n\n${request.data.ws_quran_text.arabic}`,
              )
              .setFooter({
                text: isTurkish
                  ? 'Kuran: Son Ahit • Turkish'
                  : 'Quran: The Final Testament • Random Verse',
              })
              .setColor('DarkButNotBlack'),
          ],
        });
      }
    },
  };
}

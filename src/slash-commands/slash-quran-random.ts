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

      const request = await ws.getRandomVerse({
        include_language: ['turkish']
      });

      if (request instanceof ws.Error) {
        await interaction.reply({
          content: `\`${request.message}\``,
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
                  ? `Sure ${request.response[0].chapter_number}, ${request.response[0].chapter_title_turkish}`
                  : `Sura ${request.response[0].chapter_number}, ${request.response[0].chapter_title_english}`,
              )
              .setDescription(
                `**[${request.response[0].verse_id}]** ${request.response[0][
                isTurkish ? 'verse_text_turkish' : 'verse_text_english'
                ]
                }\n\n${request.response[0].verse_text_arabic}`,
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

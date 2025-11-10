import { WSlashCommand } from '../types/w-slash-command';
import { HandleQuranRequest } from '../utils/handle-request-quran';
import { ApplicationCommandOptionType } from 'discord.js';

export default function command(): WSlashCommand {
  return {
    name: 'quran',
    description: 'Quran | English 🇺🇸',
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
      {
        name: 'no-commentary',
        description: 'Ignore subtitles & footnotes?',
        type: ApplicationCommandOptionType.String,
        choices: [
          {
            name: 'yes',
            value: 'yes',
          },
        ],
        name_localizations: {
          tr: 'yorum-yok',
        },
        description_localizations: {
          tr: 'Altyazı ve dipnot yok mu?',
        },
      },
      {
        name: 'with-transliteration',
        description: 'Include Arabic transliteration?',
        type: ApplicationCommandOptionType.String,
        choices: [
          {
            name: 'yes',
            value: 'yes',
          },
        ],
        name_localizations: {
          tr: 'transliterasyon',
        },
        description_localizations: {
          tr: 'transliterasyon içerir?',
        },
      },
    ],
    execute: async (interaction) => {
      await new HandleQuranRequest(interaction).getResultsAndReply();
    },
  };
}

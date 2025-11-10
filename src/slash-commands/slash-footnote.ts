import { ApplicationCommandOptionType } from 'discord.js';
import { WSlashCommand } from '../types/w-slash-command';
import { HandleQuranRequest } from '../utils/handle-request-quran';

export default function command(): WSlashCommand {
  return {
    name: 'footnote',
    description: 'Load a footnote from Quran: The Final Testament',
    name_localizations: {
      tr: 'dipnot',
    },
    description_localizations: {
      tr: 'Dipnot yükle',
    },
    options: [
      {
        name: 'verse',
        description: 'Verse #:# (or #:#-#)',
        type: ApplicationCommandOptionType.String,
        required: true,
        name_localizations: {
          tr: 'ayet',
        },
        description_localizations: {
          tr: 'Ayet numarasını girin',
        },
      },
    ],
    execute: async (interaction) => {
    await new HandleQuranRequest(interaction, 1, {
        footnoteOnly: true,
      }).getResultsAndReply();
    },
  };
}

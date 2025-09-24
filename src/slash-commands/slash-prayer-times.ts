import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import { WSlashCommand } from '../types/w-slash-command';

export default function command(): WSlashCommand {
  return {
    name: 'prayer-times',
    description: 'Look up live prayer times for any part of the world',
    name_localizations: {
      tr: 'namazvakitleri',
    },
    description_localizations: {
      tr: 'Bir şehir için namaz vakitlerini yükleyin',
    },
    options: [
      {
        name: 'location',
        description:
          'You can enter a city, landmark, address, or exact coordinates',
        type: ApplicationCommandOptionType.String,
        required: true,
        name_localizations: {
          tr: 'konum',
        },
        description_localizations: {
          tr: 'Şehir mi yoksa yakındaki simge yapı mı?',
        },
      },
      {
        name: 'publicly-visible',
        description:
          "Make the result viewable to others in the chat (it's hidden by default)",
        type: ApplicationCommandOptionType.String,
        choices: [
          {
            name: 'yes',
            value: 'yes',
          },
        ],
      },
      {
        name: 'asr-adjustment',
        description: 'Adjust asr calculation (midpoint)',
        type: ApplicationCommandOptionType.String,
        choices: [
          {
            name: 'yes',
            value: 'yes',
          },
        ],
      },
    ],
    execute: async (interaction) => {
      const fetchURL = new URL(`https://practices.wikisubmission.org/prayer-times/${interaction.options.get('location')!.value}`);

      fetchURL.searchParams.append('highlight', 'true');
      if (interaction.options.get('asr-adjustment')?.value === 'yes') {
        fetchURL.searchParams.append('asr_adjustment', 'true');
      }

      const req = await fetch(fetchURL);

      const request: {
        results: any;
        error?: { name: string; description: string };
      } = await req.json();

      if (request && request.results && !request.error) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(request.results.location_string)
              .setDescription(request.results.status_string)
              .addFields(
                {
                  name: 'Local Time',
                  value: codify(request.results.local_time),
                },
                {
                  name: 'Now',
                  value: codify(
                    `${capitalized(request.results.current_prayer)}`,
                  ),
                },
                {
                  name: 'Up Next',
                  value: codify(
                    `${capitalized(request.results.upcoming_prayer)} (${request.results.upcoming_prayer_time_left
                    } left)`,
                  ),
                },
                {
                  name: 'Schedule',
                  value: codify(
                    `Fajr: ${request.results.times.fajr}\nDhuhr: ${request.results.times.dhuhr}\nAsr: ${request.results.times.asr}\nMaghrib: ${request.results.times.maghrib}\nIsha: ${request.results.times.isha}\n\nSunrise: ${request.results.times.sunrise}`,
                  ),
                },
                {
                  name: 'Coordinates',
                  value: codify(
                    `${request.results.coordinates.latitude}, ${request.results.coordinates.longitude}`,
                  ),
                },
              )
              .setAuthor({
                name: `Prayer Times`,
                iconURL: `https://flagcdn.com/48x36/${request.results.country_code.toLowerCase()}.png`,
              })
              .setFooter({
                text: request.results.local_timezone,
              })
              .setColor('DarkButNotBlack'),
          ],
          flags: interaction.options.get('publicly-visible')?.value === 'yes'
            ? undefined
            : ['Ephemeral'],
        });
      } else {
        await interaction.reply({
          content: `\`${request?.error?.description || 'Internal Server Error'
            }\``,
          flags: ['Ephemeral'],
        });
      }
    },
  };
}

function codify(s: string) {
  return `\`\`\`${s}\`\`\``;
}

function capitalized(input?: string) {
  if (!input) return '';
  if (input.length === 0) return '';
  return input.charAt(0).toUpperCase() + input.slice(1);
}

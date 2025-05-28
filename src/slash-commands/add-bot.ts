import { EmbedBuilder } from 'discord.js';
import { WSlashCommand } from '../types/w-slash-command';
import { Bot } from '../bot/client';

export default function command(): WSlashCommand {
  return {
    name: 'add-bot',
    description: 'Add the bot to your server',
    execute: async (interaction) => {
      const { clientId } = await Bot.instance.getCredentials();
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('Add this bot to your server')
            .setFields({
              name: 'Link',
              value: `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=274877962240&integration_type=0&scope=bot`,
            })
            .setThumbnail(
              interaction.client.user?.displayAvatarURL() || null,
            )
            .setColor('DarkButNotBlack'),
        ],
      });
    },
  };
}

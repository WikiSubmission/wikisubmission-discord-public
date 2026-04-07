import { ActionRowBuilder, ApplicationCommandOptionType, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { WSlashCommand } from "../types/w-slash-command";
import { logError } from "../utils/log-error";
import { storeAskMessages } from "../utils/ask-message-cache";
import { buildAskMessages, generateConversationId, querySubmitterAI } from "../utils/submitter-ai";

export default function command(): WSlashCommand {
  return {
    name: "ask",
    description: "Ask SubmitterAI a question about the Quran and related topics",
    options: [
      {
        name: "question",
        description: "Your question",
        type: ApplicationCommandOptionType.String,
        max_length: 500,
        required: true,
      },
    ],
    execute: async (interaction) => {
      const question = interaction.options.get("question", true).value as string;

      try {
        await interaction.deferReply();

        const conversationId = generateConversationId();
        const data = await querySubmitterAI(question, conversationId);
        const messages = buildAskMessages(question, data);

        const safe = (s: string) => s.length > 2000 ? s.substring(0, 1997) + "…" : s;

        const buildRow = () => new ActionRowBuilder<any>().setComponents(
          new ButtonBuilder()
            .setLabel("Reply")
            .setCustomId(`ask_reply:${conversationId}`)
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel("Delete")
            .setCustomId(`ask_delete:${conversationId}`)
            .setStyle(ButtonStyle.Danger)
        );

        const first = await interaction.editReply({
          content: safe(messages[0]),
          components: messages.length === 1 ? [buildRow()] : [],
          flags: MessageFlags.SuppressEmbeds,
        });

        const sentMessages = [first];

        for (let i = 1; i < messages.length; i++) {
          const msg = await interaction.followUp({
            content: safe(messages[i]),
            components: i === messages.length - 1 ? [buildRow()] : [],
            flags: MessageFlags.SuppressEmbeds,
          });
          sentMessages.push(msg);
        }

        storeAskMessages(conversationId, interaction.user.id, sentMessages);
      } catch (error: any) {
        logError(error, `(/ask)`);

        const errorMessage = (error.message || "Internal Server Error").substring(0, 1900);

        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
              content: `\`${errorMessage}\``,
              embeds: [],
              components: [],
            });
          } else {
            await interaction.reply({
              content: `\`${errorMessage}\``,
              flags: ["Ephemeral"],
            });
          }

          setTimeout(() => {
            interaction.deleteReply().catch(() => {});
          }, 3000);
        } catch (editError) {
          logError(editError, "Failed to send error reply");
        }
      }
    },
  };
}

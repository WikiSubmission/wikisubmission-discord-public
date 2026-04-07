import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  Routes,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { WEventListener } from "../types/w-event-listener";
import { logError } from "../utils/log-error";
import { deleteAskMessages, getAskMessages, storeAskMessages } from "../utils/ask-message-cache";
import { buildAskMessages, querySubmitterAI } from "../utils/submitter-ai";

export default function listener(): WEventListener {
  return {
    name: "interactionCreate",
    handler: async (interaction) => {
      // Button click: delete all messages in this response
      if (interaction.isButton() && interaction.customId.startsWith("ask_delete:")) {
        const conversationId = interaction.customId.slice("ask_delete:".length);
        const cached = getAskMessages(conversationId);

        if (cached && interaction.user.id !== cached.userId) {
          await interaction.reply({
            content: "`Only the original requester can delete this.`",
            flags: ["Ephemeral"],
          });
          return;
        }

        try {
          await interaction.deferUpdate();

          if (cached) {
            for (const { channelId, messageId } of cached.refs) {
              await interaction.client.rest.delete(Routes.channelMessage(channelId, messageId)).catch(() => {});
            }
            deleteAskMessages(conversationId);
          } else {
            await interaction.client.rest.delete(
              Routes.channelMessage(interaction.message.channelId, interaction.message.id)
            );
          }
        } catch (error) {
          logError(error, "(ask_delete)");
        }
        return;
      }

      // Button click: open reply modal
      if (interaction.isButton() && interaction.customId.startsWith("ask_reply:")) {
        const conversationId = interaction.customId.slice("ask_reply:".length);

        const modal = new ModalBuilder()
          .setCustomId(`ask_modal:${conversationId}`)
          .setTitle("Ask a follow-up question");

        const questionInput = new TextInputBuilder()
          .setCustomId("ask_question")
          .setLabel("Your follow-up question")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500);

        modal.setComponents(
          new ActionRowBuilder<TextInputBuilder>().setComponents(questionInput)
        );

        await interaction.showModal(modal);
        return;
      }

      // Modal submit: call API and reply
      if (interaction.isModalSubmit() && interaction.customId.startsWith("ask_modal:")) {
        const conversationId = interaction.customId.slice("ask_modal:".length);
        const question = interaction.fields.getTextInputValue("ask_question");

        try {
          await interaction.deferReply();

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
          logError(error, `(ask_modal)`);

          const errorMessage = (error.message || "Internal Server Error").substring(0, 1900);

          try {
            if (interaction.deferred || interaction.replied) {
              await interaction.editReply({
                content: `\`${errorMessage}\``,
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
      }
    },
  };
}

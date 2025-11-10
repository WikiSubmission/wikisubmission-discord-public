import { EmbedBuilder, ActionRowBuilder, ButtonBuilder } from "discord.js";
import { WDiscordCommandResult } from "../types/w-discord-command-result";
import { WEventListener } from "../types/w-event-listener";
import { authenticateMember } from "../utils/authenticate-member";
import { getCachedPageData } from "../utils/cache-interaction";

export default function listener(): WEventListener {
  return {
    name: "interactionCreate",
    handler: async (interaction) => {
      if (interaction.isButton()) {
        if (interaction.customId.startsWith("page_")) {
          const interactionId = interaction.message.interactionMetadata?.id;
          if (!interactionId) return;

          // Get cached pagination data (tries DB first, falls back to local cache)
          const cachedData = await getCachedPageData(interactionId);

          if (cachedData) {
            // Verify if requestor can change the page.
            if (
              // Original requester.
              cachedData.user_id === interaction.user.id ||
              // Or, insider and above.
              authenticateMember(interaction.member, "INSIDER_AND_ABOVE")
            ) {
              // Extract desired page from custom ID.
              const desiredPage = parseInt(
                interaction.customId.split("_")[1],
                10
              );

              // Validate page number
              if (desiredPage > cachedData.total_pages) {
                await interaction.reply({
                  content: "`You've reached the last page`",
                  flags: ["Ephemeral"],
                });
                return;
              }

              if (desiredPage <= 0) {
                await interaction.reply({
                  content: "`You're on the first page`",
                  flags: ["Ephemeral"],
                });
                return;
              }

              try {
                // Defer the update to prevent interaction timeout
                await interaction.deferUpdate();

                // Get the page content from cached content array
                const pageDescription = cachedData.content[desiredPage - 1];
                const truncatedDescription =
                  pageDescription.length > 4096
                    ? pageDescription.substring(0, 4093) + ""
                    : pageDescription;

                // Create the response
                const output: WDiscordCommandResult = {
                  content: undefined,
                  embeds: [
                    new EmbedBuilder()
                      .setTitle(cachedData.title)
                      .setDescription(truncatedDescription)
                      .setFooter({
                        text: `${cachedData.footer} • Page ${desiredPage}/${cachedData.total_pages}`,
                      })
                      .setColor("DarkButNotBlack"),
                  ],
                  components: [
                    new ActionRowBuilder<any>().setComponents(
                      ...(desiredPage > 1
                        ? [
                            new ButtonBuilder()
                              .setLabel("Previous page")
                              .setCustomId(`page_${desiredPage - 1}`)
                              .setStyle(2),
                          ]
                        : []),

                      ...(desiredPage !== cachedData.total_pages
                        ? [
                            new ButtonBuilder()
                              .setLabel("Next page")
                              .setCustomId(`page_${desiredPage + 1}`)
                              .setStyle(1),
                          ]
                        : [])
                    ),
                  ],
                };

                // Update the embed.
                await interaction.editReply({
                  content: output.content,
                  embeds: output.embeds,
                  components: output.components,
                });
              } catch (error: any) {
                // Errors thrown from re-processing the request, or otherwise an internal error.
                try {
                  await interaction.editReply({
                    content: `\`${error.message || "Internal Server Error"}\``,
                  });
                } catch (editError) {
                  // If edit fails, try to follow up instead
                  await interaction.followUp({
                    content: `\`${error.message || "Internal Server Error"}\``,
                    flags: ["Ephemeral"],
                  });
                }
              }
            } else {
              // User not authorized to change page.
              await interaction.reply({
                content:
                  "`Only the original requester may change the page. You can make your own request.`",
                flags: ["Ephemeral"],
              });
              return;
            }
          } else {
            // Cached data not found in DB.
            await interaction.reply({
              content: "`Request expired. Please make a new one.`",
              flags: ["Ephemeral"],
            });
          }
        }
      }
    },
  };
}

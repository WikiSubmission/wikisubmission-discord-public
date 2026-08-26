import { WEventListener } from "../types/w-event-listener";
import { authenticateMember } from "../utils/authenticate-member";
import { isDeleteReaction } from "../utils/is-delete-reaction";
import { isQuranEmbed } from "../utils/is-quran-embed";
import { logError } from "../utils/log-error";

export default function listener(): WEventListener {
  return {
    name: "messageReactionAdd",
    handler: async (reaction, user) => {
      try {
        if (user.bot) return;

        // Reactions on older messages arrive partial and carry no embeds yet.
        if (reaction.partial) {
          await reaction.fetch().catch(() => null);
        }
        if (reaction.message.partial) {
          await reaction.message.fetch().catch(() => null);
        }

        const message = reaction.message;

        // Only our own Quran results are deletable this way.
        if (!message.author || message.author.id !== user.client.user.id) {
          return;
        }
        if (!isDeleteReaction(reaction.emoji)) return;
        if (!isQuranEmbed(message)) return;

        // The requester may always clear their own result. Guilds that have no
        // Community role still get this much.
        if (message.interactionMetadata?.user?.id === user.id) {
          await message.delete();
          return;
        }

        const member = await message.guild?.members
          .fetch(user.id)
          .catch(() => null);

        if (member && authenticateMember(member, "COMMUNITY_AND_ABOVE")) {
          await message.delete();
        }
      } catch (error) {
        logError(error, "messageReactionAdd (quran delete)");
      }
    },
  };
}

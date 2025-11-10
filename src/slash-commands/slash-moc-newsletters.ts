import { ApplicationCommandOptionType } from "discord.js";
import { WSlashCommand } from "../types/w-slash-command";
import { HandleNewslettersRequest } from "../utils/handle-request-newsletters";

export default function command(): WSlashCommand {
  return {
    name: "search-newsletters",
    description: "Search through the Submitters Perspectives Newsletters",
    options: [
      {
        name: "query",
        description: "What are you looking for?",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: "strict-search",
        description:
          "Enforce the specific word order in the query to match in results",
        type: ApplicationCommandOptionType.String,
        choices: [
          {
            name: "yes",
            value: "yes",
          },
        ],
      },
    ],
    execute: async (interaction) => {
      await new HandleNewslettersRequest(interaction).getResultsAndReply();
    },
  };
}

import { WSlashCommand } from "../types/w-slash-command";
import baseCommand from "./slash-quran";

export default function command(): WSlashCommand {
  return {
    ...baseCommand(),
    name: "esquran",
    description: "Quran | Spanish 🇪🇸",
    options: [...(baseCommand().options || [])],
  };
}

import { WSlashCommand } from "../types/w-slash-command";
import baseCommand from "./slash-quran";

export default function command(): WSlashCommand {
  return {
    ...baseCommand(),
    name: "squran",
    description: "Quran | Swedish 🇸🇪",
    options: [...(baseCommand().options || [])],
  };
}

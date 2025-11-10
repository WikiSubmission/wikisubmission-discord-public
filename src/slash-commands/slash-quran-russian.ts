import { WSlashCommand } from "../types/w-slash-command";
import baseCommand from "./slash-quran";

export default function command(): WSlashCommand {
  return {
    ...baseCommand(),
    name: "rquran",
    description: "Quran | Russian 🇷🇺",
    options: [...(baseCommand().options || [])],
  };
}

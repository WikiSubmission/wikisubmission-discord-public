import { EmbedBuilder } from "discord.js";
import { WSlashCommand } from "../types/w-slash-command";

const VERSIONS = [
  { abbrev: "sct",    name: "Submitters Community Translation", note: "default" },
  { abbrev: "kjv",    name: "King James Version" },
  { abbrev: "asv",    name: "American Standard Version" },
  { abbrev: "bbe",    name: "Bible in Basic English" },
  { abbrev: "web",    name: "World English Bible" },
  { abbrev: "webbe",  name: "World English Bible (British Edition)" },
  { abbrev: "ylt",    name: "Young's Literal Translation" },
  { abbrev: "dra",    name: "Douay-Rheims 1899" },
  { abbrev: "darby",  name: "Darby Bible" },
  { abbrev: "oeb-us", name: "Open English Bible (US Edition)" },
  { abbrev: "oeb-cw", name: "Open English Bible (Commonwealth Edition)" },
  { abbrev: "nrsvue", name: "New Revised Standard Version Updated", note: "requires API key" },
];

export default function command(): WSlashCommand {
  return {
    name: "bible-versions",
    description: "List available Bible translations",
    options: [],
    execute: async (interaction) => {
      const lines = VERSIONS.map((v) => {
        const tag = v.note ? ` *(${v.note})*` : "";
        return `\`${v.abbrev.padEnd(7)}\`  ${v.name}${tag}`;
      }).join("\n");

      const embed = new EmbedBuilder()
        .setColor("Purple")
        .setTitle("Bible Translations")
        .setDescription(lines)
        .setFooter({
          text: `Usage: /bible John 3:16  ·  /bible Genesis 1:1-3 [translation]`,
        });

      await interaction.reply({ embeds: [embed] });
    },
  };
}

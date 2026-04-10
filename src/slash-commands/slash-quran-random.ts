import { ApplicationCommandOptionType, EmbedBuilder } from "discord.js";
import { WSlashCommand } from "../types/w-slash-command";
import { wsApi } from "../utils/ws-api";

// Verse counts per chapter (index 0 = chapter 1, index 113 = chapter 114)
const CHAPTER_VERSE_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128,
  111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73,
  54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60,
  49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52,
  44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19,
  26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3,
  6, 3, 5, 4, 5, 6,
];

export default function command(): WSlashCommand {
  return {
    name: "random-verse",
    description: "Get a random verse from the Quran",
    options: [
      {
        name: "language",
        description: "Choose another language",
        type: ApplicationCommandOptionType.String,
        choices: ["turkish"].map((i) => ({
          name: i,
          value: i,
        })),
        name_localizations: {
          tr: "dil",
        },
        description_localizations: {
          tr: "Farklı dil?",
        },
      },
    ],
    name_localizations: {
      tr: "rastgele",
    },
    description_localizations: {
      tr: "Rastgele ayet",
    },
    execute: async (interaction) => {
      const isTurkish =
        interaction.options.get("language")?.value === "turkish" ||
        (interaction.locale === "tr" &&
          interaction.options.get("language")?.value !== "english");

      // Pick a random chapter (1–114) and a random verse within it
      const chapter = Math.floor(Math.random() * 114) + 1;
      const verseCount = CHAPTER_VERSE_COUNTS[chapter - 1];
      const verse = Math.floor(Math.random() * verseCount) + 1;
      const verseRef = `${chapter}:${verse}`;

      try {
        const response = await wsApi.getQuran({
          verses: verseRef,
          langs: isTurkish ? ["tr", "ar"] : ["en", "ar"],
        });

        const chapterData = response.chapters?.[0];
        const verseData = chapterData?.verses?.[0];

        if (!chapterData || !verseData) {
          await interaction.reply({
            content: `\`Failed to fetch random verse\``,
            flags: ["Ephemeral"],
          });
          return;
        }

        const langCode = isTurkish ? "tr" : "en";
        const chTitle =
          chapterData.titles?.[langCode] ?? chapterData.titles?.["en"] ?? "";
        const titlePrefix = isTurkish ? "Sure" : "Sura";
        const text = verseData.tr?.[langCode]?.tx ?? "";
        const arabicText = verseData.tr?.["ar"]?.tx ?? "";
        const footerText = isTurkish
          ? "Kuran: Son Ahit • Turkish"
          : "Quran: The Final Testament • Random Verse";

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${titlePrefix} ${chapterData.cn}, ${chTitle}`)
              .setDescription(
                `**[${verseData.vk}]** ${text}\n\n${arabicText}`
              )
              .setFooter({ text: footerText })
              .setColor("DarkButNotBlack"),
          ],
        });
      } catch (error: any) {
        await interaction.reply({
          content: `\`${error.message || "Failed to fetch random verse"}\``,
          flags: ["Ephemeral"],
        });
      }
    },
  };
}

import { WSlashCommand } from '../types/w-slash-command';
import baseCommand from './slash-quran';

export default function command(): WSlashCommand {
  return {
    ...baseCommand(),
    name: 'pquran',
    description: 'Quran | Persian 🇮🇷',
    options: [...(baseCommand().options || [])],
  };
}

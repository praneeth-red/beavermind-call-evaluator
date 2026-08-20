import type { TranscriptTurn } from "./types";

export function parseTranscript(text: string): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];

  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;

    const match = line.match(/^\[([^\]\r\n]+)\]: (.+)$/);
    if (!match) throw new Error(`Invalid transcript line ${index + 1}. Expected [Speaker]: text.`);

    turns.push({ number: turns.length + 1, speaker: match[1], text: match[2] });
  }

  return turns;
}

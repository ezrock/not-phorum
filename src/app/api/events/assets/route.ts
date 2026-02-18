import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MIDI_EXT = /\.(mid|midi)$/i;
const LOGO_EXT = /\.(png|jpe?g|gif|svg|webp)$/i;

async function listFiles(relativeDir: string, allowedExt: RegExp): Promise<string[]> {
  const fullPath = path.join(process.cwd(), 'public', relativeDir);

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith('.'))
      .filter((name) => allowedExt.test(name))
      .sort((a, b) => a.localeCompare(b, 'fi'));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return [];
    throw error;
  }
}

export async function GET() {
  const [midiSongs, logos] = await Promise.all([
    listFiles('midi', MIDI_EXT),
    listFiles('logo', LOGO_EXT),
  ]);

  return NextResponse.json({ midiSongs, logos });
}

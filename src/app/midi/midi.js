/**
 * ChiptunePlayer + runtime MIDI parser (no external dependencies).
 */

const WAVE_TYPES = ['square', 'triangle', 'sawtooth', 'sine'];
const MIDI_CACHE = new Map();

function readUint32(view, offset) {
  return view.getUint32(offset, false);
}

function readUint16(view, offset) {
  return view.getUint16(offset, false);
}

function readAscii(view, offset, length) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += String.fromCharCode(view.getUint8(offset + i));
  }
  return out;
}

function readVlq(view, offset) {
  let value = 0;
  let i = offset;
  let byte = 0;

  do {
    byte = view.getUint8(i);
    value = (value << 7) | (byte & 0x7f);
    i += 1;
  } while ((byte & 0x80) !== 0 && i < view.byteLength);

  return { value, nextOffset: i };
}

function parseMidi(arrayBuffer) {
  const view = new DataView(arrayBuffer);

  if (readAscii(view, 0, 4) !== 'MThd') {
    throw new Error('Invalid MIDI: missing MThd header');
  }

  const headerLength = readUint32(view, 4);
  readUint16(view, 8); // MIDI format (currently not used in conversion)
  const trackCount = readUint16(view, 10);
  const division = readUint16(view, 12);

  if ((division & 0x8000) !== 0) {
    throw new Error('SMPTE time division is not supported');
  }

  const ticksPerBeat = division;
  let offset = 8 + headerLength;
  let tempoMicrosPerBeat = 500000;

  const parsedTracks = [];

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
    if (offset + 8 > view.byteLength) break;
    const chunkType = readAscii(view, offset, 4);
    offset += 4;

    const chunkLength = readUint32(view, offset);
    offset += 4;

    if (chunkType !== 'MTrk') {
      offset += chunkLength;
      continue;
    }

    const trackEnd = Math.min(offset + chunkLength, view.byteLength);
    let cursor = offset;
    let absoluteTicks = 0;
    let runningStatus = null;

    const noteStarts = new Map();
    const notes = [];

    while (cursor < trackEnd) {
      const deltaRead = readVlq(view, cursor);
      absoluteTicks += deltaRead.value;
      cursor = deltaRead.nextOffset;
      if (cursor >= trackEnd) break;

      let status = view.getUint8(cursor);
      if ((status & 0x80) !== 0) {
        cursor += 1;
        runningStatus = status;
      } else {
        if (runningStatus === null) break;
        status = runningStatus;
      }

      if (status === 0xff) {
        if (cursor >= trackEnd) break;
        const metaType = view.getUint8(cursor);
        cursor += 1;
        const metaLenRead = readVlq(view, cursor);
        const metaLen = metaLenRead.value;
        cursor = metaLenRead.nextOffset;

        if (metaType === 0x51 && metaLen === 3) {
          tempoMicrosPerBeat = (view.getUint8(cursor) << 16)
            | (view.getUint8(cursor + 1) << 8)
            | view.getUint8(cursor + 2);
        }

        cursor += metaLen;
        continue;
      }

      if (status === 0xf0 || status === 0xf7) {
        const sysexLenRead = readVlq(view, cursor);
        cursor = sysexLenRead.nextOffset + sysexLenRead.value;
        continue;
      }

      const eventType = status & 0xf0;
      const channel = status & 0x0f;

      if (eventType === 0xc0 || eventType === 0xd0) {
        cursor += 1;
        continue;
      }

      if (cursor + 1 > trackEnd) break;
      const data1 = view.getUint8(cursor);
      const data2 = view.getUint8(cursor + 1);
      cursor += 2;

      if (eventType === 0x90 && data2 > 0) {
        noteStarts.set(`${channel}:${data1}`, absoluteTicks);
      } else if (eventType === 0x80 || (eventType === 0x90 && data2 === 0)) {
        const key = `${channel}:${data1}`;
        const startTicks = noteStarts.get(key);
        if (startTicks !== undefined && absoluteTicks > startTicks) {
          notes.push({
            pitch: data1,
            startTicks,
            durationTicks: absoluteTicks - startTicks,
          });
        }
        noteStarts.delete(key);
      }
    }

    notes.sort((a, b) => a.startTicks - b.startTicks || a.pitch - b.pitch);
    parsedTracks.push(notes);

    offset = trackEnd;
  }

  const bpm = Math.max(60, Math.min(220, Math.round(60000000 / tempoMicrosPerBeat)));

  const tracks = parsedTracks
    .map((notes, idx) => {
      if (notes.length === 0) return null;

      let cursorTicks = 0;
      const outNotes = [];

      for (const note of notes) {
        const startTicks = Math.max(note.startTicks, cursorTicks);

        if (startTicks > cursorTicks) {
          const restBeats = (startTicks - cursorTicks) / ticksPerBeat;
          outNotes.push([0, restBeats]);
        }

        const durBeats = note.durationTicks / ticksPerBeat;
        outNotes.push([note.pitch, durBeats]);
        cursorTicks = startTicks + note.durationTicks;
      }

      if (outNotes.length === 0) return null;

      return {
        type: WAVE_TYPES[idx % WAVE_TYPES.length],
        volume: idx === 0 ? 0.12 : 0.08,
        notes: outNotes,
      };
    })
    .filter(Boolean);

  if (tracks.length === 0) {
    throw new Error('MIDI file does not contain playable note events');
  }

  return { bpm, tracks };
}

export async function loadMidiSongFromUrl(url) {
  if (MIDI_CACHE.has(url)) return MIDI_CACHE.get(url);

  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) {
    throw new Error(`Failed to fetch MIDI: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const song = parseMidi(arrayBuffer);
  MIDI_CACHE.set(url, song);
  return song;
}

export class ChiptunePlayer {
  constructor(song, options = {}) {
    this.song = song;
    this.ctx = null;
    this.gainNode = null;
    this.playing = false;
    this._nodes = [];
    this._loopTimeout = null;
    this.volume = typeof options.volume === 'number' ? options.volume : 0.35;
  }

  // Convert MIDI note number to frequency
  _freq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  _getCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.ctx;
  }

  _playNote(freq, start, dur, type, vol) {
    const ac = this.ctx;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.01);
    g.gain.setValueAtTime(vol, start + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, start + dur);
    osc.connect(g);
    g.connect(this.gainNode);
    osc.start(start);
    osc.stop(start + dur + 0.05);
    this._nodes.push(osc);
  }

  _schedule() {
    const ac = this.ctx;
    const beat = 60 / this.song.bpm;
    this._nodes = [];

    let maxEnd = 0;

    for (const track of this.song.tracks) {
      let t = ac.currentTime + 0.05;
      for (const [note, beats] of track.notes) {
        const dur = Math.max(0.01, beats * beat);
        if (note > 0) {
          this._playNote(this._freq(note), t, dur * 0.9, track.type, track.volume);
        }
        t += dur;
      }
      maxEnd = Math.max(maxEnd, t);
    }

    const loopIn = Math.max(50, (maxEnd - ac.currentTime - 0.1) * 1000);
    this._loopTimeout = setTimeout(() => {
      if (this.playing) this._schedule();
    }, loopIn);
  }

  play() {
    if (this.playing) return;
    const ac = this._getCtx();
    if (ac.state === 'suspended') {
      ac.resume().catch(() => {
        // Ignore autoplay resume errors; caller can retry after gesture.
      });
    }
    this.gainNode = ac.createGain();
    this.gainNode.gain.setValueAtTime(this.volume, ac.currentTime);
    this.gainNode.connect(ac.destination);
    this.playing = true;
    this._schedule();
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearTimeout(this._loopTimeout);
    this._nodes.forEach((n) => {
      try {
        n.stop();
      } catch {
        // Ignore nodes already stopped.
      }
    });
    this._nodes = [];
  }

  toggle() {
    if (this.playing) this.stop();
    else this.play();
  }

  // Set master volume (0.0 - 1.0)
  setVolume(val) {
    this.volume = val;
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(val, this.ctx.currentTime);
    }
  }
}

export class MidiBackgroundController {
  constructor(options = {}) {
    this.player = null;
    this.currentUrl = null;
    this.volume = typeof options.volume === 'number' ? options.volume : 0.35;
    this.unlockHandler = null;
  }

  _cleanupUnlockHandlers() {
    if (!this.unlockHandler) return;
    window.removeEventListener('click', this.unlockHandler);
    window.removeEventListener('keydown', this.unlockHandler);
    window.removeEventListener('touchstart', this.unlockHandler);
    this.unlockHandler = null;
  }

  _armUnlockRetry() {
    if (this.unlockHandler) return;
    this.unlockHandler = () => {
      if (!this.player) return;
      this.player.play();
      this._cleanupUnlockHandlers();
    };

    window.addEventListener('click', this.unlockHandler, { once: true });
    window.addEventListener('keydown', this.unlockHandler, { once: true });
    window.addEventListener('touchstart', this.unlockHandler, { once: true });
  }

  async playUrl(url) {
    if (this.currentUrl === url && this.player?.playing) return;

    const song = await loadMidiSongFromUrl(url);

    this.stop();

    this.player = new ChiptunePlayer(song, { volume: this.volume });
    this.currentUrl = url;
    this.player.play();

    if (this.player.ctx?.state === 'suspended') {
      this._armUnlockRetry();
    }
  }

  stop() {
    this._cleanupUnlockHandlers();
    if (this.player) {
      this.player.stop();
      this.player = null;
    }
    this.currentUrl = null;
  }
}

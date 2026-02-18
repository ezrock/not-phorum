/**
 * ChiptunePlayer
 * Lightweight Web Audio API MIDI-style player. No dependencies.
 *
 * Usage:
 *   const player = new ChiptunePlayer(song);
 *   player.play();
 *   player.stop();
 *   player.toggle();
 *
 * Song format:
 *   {
 *     bpm: 140,
 *     tracks: [
 *       { notes: [[midiNote, beats], ...], type: 'square',   volume: 0.15 },
 *       { notes: [[midiNote, beats], ...], type: 'sawtooth', volume: 0.12 },
 *     ]
 *   }
 */

export class ChiptunePlayer {
  constructor(song) {
    this.song = song;
    this.ctx = null;
    this.gainNode = null;
    this.playing = false;
    this._nodes = [];
    this._loopTimeout = null;
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
        const dur = beats * beat;
        this._playNote(this._freq(note), t, dur * 0.9, track.type, track.volume);
        t += dur;
      }
      maxEnd = Math.max(maxEnd, t);
    }

    const loopIn = (maxEnd - ac.currentTime - 0.1) * 1000;
    this._loopTimeout = setTimeout(() => {
      if (this.playing) this._schedule();
    }, loopIn);
  }

  play() {
    if (this.playing) return;
    const ac = this._getCtx();
    if (ac.state === 'suspended') ac.resume();
    this.gainNode = ac.createGain();
    this.gainNode.connect(ac.destination);
    this.playing = true;
    this._schedule();
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearTimeout(this._loopTimeout);
    this._nodes.forEach(n => { try { n.stop(); } catch (e) {} });
    this._nodes = [];
  }

  toggle() {
    this.playing ? this.stop() : this.play();
  }

  // Set master volume (0.0 - 1.0)
  setVolume(val) {
    if (this.gainNode) this.gainNode.gain.setValueAtTime(val, this.ctx.currentTime);
  }
}


// --- Example song (remove if not needed) ---

const BPM = 140;
const B = 1; // 1 beat unit — durations are in beats

export const exampleSong = {
  bpm: BPM,
  tracks: [
    {
      type: 'square',
      volume: 0.15,
      notes: [
        [64,0.5],[64,0.5],[65,1],[67,1],
        [67,1],[65,1],[64,0.5],[62,0.5],
        [60,1],[60,1],[62,1],[64,1],
        [64,1.5],[62,0.5],[62,2],
        [64,0.5],[64,0.5],[65,1],[67,1],
        [67,1],[65,1],[64,0.5],[62,0.5],
        [60,1],[60,1],[62,1],[64,1],
        [62,1.5],[60,0.5],[60,2],
      ],
    },
    {
      type: 'sawtooth',
      volume: 0.12,
      notes: [
        [40,2],[43,2],[45,2],[47,2],
        [40,2],[43,2],[45,2],[47,2],
      ],
    },
  ],
};
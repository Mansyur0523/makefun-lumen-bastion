// All sound is synthesised here with WebAudio — no audio files. A tiny synth builds
// each effect from oscillators and filtered noise, and a quiet pad loop plays a slow
// chord walk while the game runs. Nothing here touches the DOM or the game state.

const NOTE = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0, C6: 1046.5, E6: 1318.5,
};

/** A slow, calm chord walk for the background pad: Am – F – C – G. */
const PAD_CHORDS = [
  [NOTE.A3, NOTE.C4, NOTE.E4],
  [NOTE.F3, NOTE.A3, NOTE.C4],
  [NOTE.C3, NOTE.E3, NOTE.G3],
  [NOTE.G3, NOTE.B3, NOTE.D4],
];
const PAD_STEP = 4.2;

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let chordIndex = 0;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.05;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  /** Resume the context after a user gesture; browsers start it suspended. */
  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume();
  }

  function tone({ freq, freqEnd, type, at, dur, gain, dest }) {
    if (!context) return;
    const t0 = context.currentTime + (at || 0);
    const osc = context.createOscillator();
    const g = context.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest || master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise({ at, dur, gain, freq, type }) {
    if (!context) return;
    const t0 = context.currentTime + (at || 0);
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.value = freq || 1200;
    const g = context.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    source.connect(filter);
    filter.connect(g);
    g.connect(master);
    source.start(t0);
  }

  function playChord(notes) {
    if (!context) return;
    for (const freq of notes) {
      const osc = context.createOscillator();
      const g = context.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t0 = context.currentTime;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(1, t0 + 1.4);
      g.gain.linearRampToValueAtTime(0.0001, t0 + PAD_STEP + 0.6);
      osc.connect(g);
      g.connect(musicGain);
      osc.start(t0);
      osc.stop(t0 + PAD_STEP + 0.8);
    }
  }

  function startMusic() {
    if (!context || musicTimer !== null) return;
    playChord(PAD_CHORDS[0]);
    chordIndex = 1;
    musicTimer = window.setInterval(() => {
      playChord(PAD_CHORDS[chordIndex % PAD_CHORDS.length]);
      chordIndex += 1;
    }, PAD_STEP * 1000);
  }

  function stopMusic() {
    if (musicTimer !== null) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  const api = {
    unlock,
    get muted() { return muted; },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) stopMusic();
      else if (context) startMusic();
    },
    startMusic() { if (ensure()) startMusic(); },

    shoot() {
      if (!context || muted) return;
      tone({ freq: 880, freqEnd: 320, type: 'square', dur: 0.09, gain: 0.05 });
    },
    frost() {
      if (!context || muted) return;
      tone({ freq: 1240, freqEnd: 1560, type: 'sine', dur: 0.16, gain: 0.04 });
    },
    burst() {
      if (!context || muted) return;
      noise({ dur: 0.22, gain: 0.12, freq: 900 });
      tone({ freq: 220, freqEnd: 70, type: 'sine', dur: 0.22, gain: 0.1 });
    },
    kill() {
      if (!context || muted) return;
      tone({ freq: 520, freqEnd: 180, type: 'triangle', dur: 0.14, gain: 0.09 });
    },
    coin() {
      if (!context || muted) return;
      tone({ freq: NOTE.E5, dur: 0.07, gain: 0.06 });
      tone({ freq: NOTE.G5, at: 0.06, dur: 0.12, gain: 0.06 });
    },
    leak() {
      if (!context || muted) return;
      tone({ freq: 160, freqEnd: 60, type: 'sawtooth', dur: 0.4, gain: 0.14 });
      noise({ dur: 0.3, gain: 0.08, freq: 500 });
    },
    build() {
      if (!context || muted) return;
      tone({ freq: NOTE.C4, dur: 0.1, gain: 0.08 });
      tone({ freq: NOTE.E4, at: 0.08, dur: 0.1, gain: 0.08 });
      tone({ freq: NOTE.G4, at: 0.16, dur: 0.18, gain: 0.08 });
    },
    upgrade() {
      if (!context || muted) return;
      tone({ freq: NOTE.G4, dur: 0.09, gain: 0.08 });
      tone({ freq: NOTE.C5, at: 0.07, dur: 0.09, gain: 0.08 });
      tone({ freq: NOTE.E5, at: 0.14, dur: 0.16, gain: 0.08 });
    },
    horn() {
      if (!context || muted) return;
      tone({ freq: NOTE.C4, type: 'sawtooth', dur: 0.5, gain: 0.07 });
      tone({ freq: NOTE.G3, type: 'sawtooth', dur: 0.5, gain: 0.06 });
      tone({ freq: NOTE.C5, at: 0.35, type: 'sawtooth', dur: 0.4, gain: 0.05 });
    },
    boss() {
      if (!context || muted) return;
      tone({ freq: 90, freqEnd: 45, type: 'sawtooth', dur: 0.9, gain: 0.16 });
      noise({ dur: 0.8, gain: 0.1, freq: 300 });
    },
    victory() {
      if (!context || muted) return;
      const seq = [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6];
      seq.forEach((freq, i) => tone({ freq, at: i * 0.11, dur: 0.3, gain: 0.09 }));
    },
    defeat() {
      if (!context || muted) return;
      const seq = [NOTE.E4, NOTE.D4, NOTE.C4, NOTE.A3];
      seq.forEach((freq, i) => tone({ freq, at: i * 0.22, dur: 0.4, gain: 0.09, type: 'triangle' }));
    },
    click() {
      if (!context || muted) return;
      tone({ freq: 660, dur: 0.05, gain: 0.05 });
    },
    denied() {
      if (!context || muted) return;
      tone({ freq: 180, freqEnd: 120, type: 'square', dur: 0.12, gain: 0.06 });
    },
  };
  return api;
}

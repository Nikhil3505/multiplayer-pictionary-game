// Web Audio API Synthesized Sound Manager
// 100% reliable, zero external dependencies, no CORS or 403 errors.

class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('sound_muted') === 'true';
  }

  // Initialize or resume the AudioContext upon user gesture
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('sound_muted', this.muted);
    if (!this.muted) {
      this.playTick(); // Brief audible feedback
    }
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  // Countdown warning tick (e.g., 5s, 4s remaining)
  playTick(pitch = 880) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {
      console.warn('Audio tick error:', e);
    }
  }

  // Urgent countdown tick for final 3 seconds
  playUrgentTick() {
    this.playTick(1200);
  }

  // Times up buzzer when timer reaches 0
  playTimesUp() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch (e) {
      console.warn('Audio buzzer error:', e);
    }
  }

  // Correct guess pleasant chime (rising notes)
  playCorrectGuess() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      [
        { freq: 523.25, time: now },       // C5
        { freq: 659.25, time: now + 0.1 }, // E5
        { freq: 783.99, time: now + 0.2 }, // G5
      ].forEach(note => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note.freq, note.time);
        gain.gain.setValueAtTime(0.25, note.time);
        gain.gain.exponentialRampToValueAtTime(0.001, note.time + 0.18);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(note.time);
        osc.stop(note.time + 0.18);
      });
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }

  // Victory Fanfare when game finishes
  playFanfare() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      [
        { freq: 523.25, time: now, dur: 0.12 },        // C5
        { freq: 659.25, time: now + 0.12, dur: 0.12 }, // E5
        { freq: 783.99, time: now + 0.24, dur: 0.12 }, // G5
        { freq: 1046.5, time: now + 0.36, dur: 0.4 },  // C6
      ].forEach(note => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.freq, note.time);
        gain.gain.setValueAtTime(0.3, note.time);
        gain.gain.exponentialRampToValueAtTime(0.001, note.time + note.dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(note.time);
        osc.stop(note.time + note.dur);
      });
    } catch (e) {
      console.warn('Audio fanfare error:', e);
    }
  }

  // Stroke undo swoosh sound
  playUndo() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch (e) {
      console.warn('Audio undo error:', e);
    }
  }
}

export const soundManager = new SoundManager();

// Automatically unlock AudioContext on user interaction anywhere on the page
if (typeof window !== 'undefined') {
  const unlock = () => {
    soundManager.init();
    ['click', 'keydown', 'touchstart'].forEach(evt => {
      window.removeEventListener(evt, unlock);
    });
  };
  ['click', 'keydown', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, unlock, { once: true });
  });
}

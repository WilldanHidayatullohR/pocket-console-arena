class ArcadeSoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmTimer = null;
    this.step = 0;
  }

  ensureContext() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  unlock() {
    this.ensureContext();
  }

  setMuted(mute) {
    this.muted = Boolean(mute);
    if (this.muted) {
      this.stopBgm();
    }
  }

  playTone(freq, duration = 0.1, type = 'triangle', gainPeak = 0.08, delay = 0) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playOrbPickup() {
    this.playTone(660, 0.08, 'sine', 0.09, 0);
    this.playTone(990, 0.11, 'triangle', 0.09, 0.05);
  }

  playDash() {
    this.playTone(320, 0.12, 'sawtooth', 0.06, 0);
    this.playTone(540, 0.07, 'sine', 0.04, 0.04);
  }

  playTag() {
    this.playTone(220, 0.14, 'square', 0.08, 0);
    this.playTone(150, 0.18, 'sawtooth', 0.08, 0.08);
  }

  playHit() {
    this.playTone(135, 0.16, 'sawtooth', 0.09, 0);
    this.playTone(85, 0.22, 'square', 0.075, 0.05);
  }

  playGameOver() {
    this.playTone(523.25, 0.14, 'triangle', 0.09, 0);
    this.playTone(659.25, 0.14, 'triangle', 0.09, 0.13);
    this.playTone(783.99, 0.25, 'triangle', 0.1, 0.26);
  }

  startBgm(mode = 'orb_hunt') {
    this.stopBgm();
    if (this.muted) return;
    this.ensureContext();

    const patterns = {
      tag_arena: {
        tempo: 210,
        notes: [110, 110, 146.83, 130.81, 110, 164.81, 146.83, 123.47],
        lead: 'sawtooth',
      },
      meteor_dodge: {
        tempo: 195,
        notes: [98.0, 116.54, 130.81, 116.54, 98.0, 146.83, 130.81, 110.0],
        lead: 'square',
      },
      orb_hunt: {
        tempo: 240,
        notes: [130.81, 164.81, 196.0, 164.81, 146.83, 174.61, 220.0, 196.0],
        lead: 'triangle',
      },
    };

    const active = patterns[mode] || patterns.orb_hunt;
    this.step = 0;

    this.bgmTimer = window.setInterval(() => {
      if (this.muted) return;
      const note = active.notes[this.step % active.notes.length];
      this.playTone(note, 0.16, active.lead, 0.032, 0);
      if (this.step % 2 === 1) {
        this.playTone(note * 2, 0.07, 'sine', 0.018, 0);
      }
      this.step += 1;
    }, active.tempo);
  }

  stopBgm() {
    if (this.bgmTimer) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

export const soundEngine = new ArcadeSoundEngine();
/**
 * Procedural Web Audio Medieval Soundscape (Zero External Assets)
 * Synthesizes retro-medieval sound effects and fanfares using native Web Audio API oscillators and noise buffers.
 * Gracefully silent and no-op in headless Node.js test environments.
 */
export class AudioManager {
  private static instance: AudioManager;
  private ctx: AudioContext | null = null;
  private muted = false;

  private constructor() {
    this.initAudioContext();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public static playUiClick(): void {
    AudioManager.getInstance().playUiClick();
  }

  public static playFanfare(): void {
    AudioManager.getInstance().playFanfare();
  }

  public static play(sound: string): void {
    const audio = AudioManager.getInstance();
    switch (sound) {
      case 'fanfare':
      case 'victory':
        audio.playFanfare();
        break;
      case 'whoosh':
      case 'arrow':
        audio.playCatapultLaunch();
        break;
      case 'impact':
      case 'joust_hit':
        audio.playLanceImpact(false);
        break;
      case 'cheer':
        audio.playCrowdCheer();
        break;
      case 'click':
      default:
        audio.playUiClick();
        break;
    }
  }

  public static playTheme(_theme?: string): void {
    AudioManager.playFanfare();
  }

  private initAudioContext(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    } catch {
      this.ctx = null;
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx) {
      this.initAudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  /**
   * Procedural Medieval Brass Fanfare (Royal proclamations, Victory, Joust start)
   */
  public playFanfare(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Classic medieval fanfare motif: C4 -> G4 -> C5 -> E5 -> G5
    const notes = [
      { f: 261.63, t: 0.0, d: 0.14 },
      { f: 392.0, t: 0.16, d: 0.14 },
      { f: 523.25, t: 0.32, d: 0.22 },
      { f: 659.25, t: 0.56, d: 0.18 },
      { f: 783.99, t: 0.76, d: 0.45 },
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(n.f, now + n.t);

      // Lowpass warmth to simulate heraldic brass trumpet
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now + n.t);
      filter.frequency.exponentialRampToValueAtTime(700, now + n.t + n.d);

      gain.gain.setValueAtTime(0.0001, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.18, now + n.t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + n.t);
      osc.stop(now + n.t + n.d);
    });
  }

  /**
   * Rhythmic Horse Hoofbeats (charging down the tilt-yard or marching army)
   */
  public playHoofbeats(count = 2): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    for (let i = 0; i < count; i++) {
      const t = now + i * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.06);

      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.08);
    }
  }

  /**
   * Heavy Lance Impact on Shield (timber shattering + metal clang)
   */
  public playLanceImpact(unhorsed = false): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Wood splinter noise burst
    const bufferSize = ctx.sampleRate * (unhorsed ? 0.35 : 0.2);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.Q.setValueAtTime(2.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(unhorsed ? 0.45 : 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (unhorsed ? 0.35 : 0.2));

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    // 2. Iron clang
    const osc = ctx.createOscillator();
    const clangGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(unhorsed ? 290 : 440, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.25);

    clangGain.gain.setValueAtTime(0.28, now);
    clangGain.gain.exponentialRampToValueAtTime(0.001, now + (unhorsed ? 0.4 : 0.25));

    osc.connect(clangGain);
    clangGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);

    if (unhorsed) {
      this.playCrowdCheer();
    }
  }

  /**
   * Steel Sword Clash & Parry
   */
  public playSwordClash(parried = false): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = parried ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(parried ? 880 : 340, now);
    osc.frequency.exponentialRampToValueAtTime(parried ? 1200 : 90, now + (parried ? 0.22 : 0.14));

    gain.gain.setValueAtTime(parried ? 0.22 : 0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (parried ? 0.24 : 0.15));

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Catapult Launch / Ballistic Swing
   */
  public playCatapultLaunch(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(70, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.35);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.38);
  }

  /**
   * Castle Wall Hit / Boulder Crash
   */
  public playWallCrash(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.45;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.4);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  /**
   * Crowd Roar / Tournament Cheering
   */
  public playCrowdCheer(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.8;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, now);
    filter.Q.setValueAtTime(1.2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  /**
   * Discordant Foul Horn (horse strike or foul disqualification)
   */
  public playFoulHorn(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [165, 175].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    });
  }

  /**
   * Tactile Medieval UI Button Click
   */
  public playUiClick(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.04);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }
}

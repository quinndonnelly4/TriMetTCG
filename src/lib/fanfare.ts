import type { Rarity } from '../types';

const NOTES = [
  { f: 523.25, t: 0, d: 0.16 },
  { f: 659.25, t: 0.1, d: 0.16 },
  { f: 783.99, t: 0.2, d: 0.16 },
  { f: 1046.5, t: 0.32, d: 0.5 },
];

export function createFanfareContext(): AudioContext | null {
  const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor();
  void ctx.resume();
  return ctx;
}

export function playFanfare(ctx: AudioContext | null): void {
  if (!ctx) return;
  void ctx.resume();
  const t0 = ctx.currentTime + 0.02;
  const master = ctx.createGain();
  master.gain.value = 0.16;
  master.connect(ctx.destination);

  for (const n of NOTES) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = n.f;
    g.gain.setValueAtTime(0.001, t0 + n.t);
    g.gain.exponentialRampToValueAtTime(1, t0 + n.t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + n.t + n.d);
    osc.connect(g).connect(master);
    osc.start(t0 + n.t);
    osc.stop(t0 + n.t + n.d + 0.05);
  }

  const chord = [523.25, 659.25, 783.99];
  for (const f of chord) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.001, t0 + 0.32);
    g.gain.exponentialRampToValueAtTime(0.55, t0 + 0.38);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.85);
    osc.connect(g).connect(master);
    osc.start(t0 + 0.32);
    osc.stop(t0 + 0.9);
  }
}

function ping(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  start: number,
  dur: number,
  peak: number,
  type: OscillatorType = 'triangle',
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + 0.018);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(g).connect(dest);
  osc.start(start);
  osc.stop(start + dur + 0.04);
}

export function playRaritySting(ctx: AudioContext | null, rarity: Rarity | undefined): void {
  if (!ctx || !rarity) return;
  void ctx.resume();
  const t0 = ctx.currentTime + 0.02;
  const master = ctx.createGain();
  master.connect(ctx.destination);

  if (rarity === 'common') {
    master.gain.value = 0.13;
    ping(ctx, master, 659.25, t0, 0.14, 0.85);
    ping(ctx, master, 987.77, t0 + 0.07, 0.22, 0.7, 'sine');
    return;
  }

  if (rarity === 'uncommon') {
    master.gain.value = 0.15;
    ping(ctx, master, 523.25, t0, 0.16, 0.7);
    ping(ctx, master, 783.99, t0 + 0.08, 0.18, 0.85);
    ping(ctx, master, 1174.66, t0 + 0.18, 0.32, 0.8, 'sine');
    ping(ctx, master, 1567.98, t0 + 0.22, 0.28, 0.35, 'sine');
    return;
  }

  if (rarity === 'rare') {
    master.gain.value = 0.17;
    const arp = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    arp.forEach((f, i) => {
      ping(ctx, master, f, t0 + i * 0.07, 0.22, 0.55 + i * 0.08, i > 2 ? 'sine' : 'triangle');
    });
    ping(ctx, master, 2093, t0 + 0.34, 0.55, 0.28, 'sine');
    ping(ctx, master, 1567.98, t0 + 0.38, 0.7, 0.22, 'sine');
    return;
  }

  master.gain.value = 0.2;
  ping(ctx, master, 130.81, t0, 0.9, 0.32, 'sine');
  const climb = [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5];
  climb.forEach((f, i) => {
    ping(ctx, master, f, t0 + i * 0.065, 0.28, 0.5 + i * 0.07, i > 3 ? 'sine' : 'triangle');
  });
  ping(ctx, master, 1318.51, t0 + 0.42, 0.55, 0.28, 'sine');
  ping(ctx, master, 1567.98, t0 + 0.46, 0.7, 0.24, 'sine');
  ping(ctx, master, 2093, t0 + 0.5, 0.85, 0.2, 'sine');
  ping(ctx, master, 2637, t0 + 0.54, 0.9, 0.14, 'sine');
}

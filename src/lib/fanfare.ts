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

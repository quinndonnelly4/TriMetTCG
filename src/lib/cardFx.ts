import type { CSSProperties } from 'react';

/** Catch-up per frame. Lower = more lag behind the finger. */
export const CARD_FOLLOW = {
  near: 0.14,
  far: 0.52,
  range: 220,
};

export const CARD_TILT = {
  max: 12,
  range: 150,
  yawMax: 24,
  pitchMax: 24,
};

export type CardLight = {
  restX: number;
  restY: number;
  angle: string;
  shineOp: number;
  specX: number;
  specY: number;
  fillX: number;
  fillY: number;
  peak: number;
  sizeA: string;
  sizeB: string;
  sizeC: string;
  fromA: string;
  fromB: string;
  fromC: string;
  toA: string;
  toB: string;
  toC: string;
  endA: string;
  endB: string;
  endC: string;
};

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCardLight(seed: string): CardLight {
  const r = rng(seed);
  const specX = 52 + r() * 38;
  const specY = 2 + r() * 24;
  const fillX = 4 + r() * 30;
  const fillY = 64 + r() * 30;
  const streakX = 58 + r() * 30;
  const streakY = 4 + r() * 20;
  const j = (n: number) => (r() - 0.5) * n;
  return {
    restX: 54 + r() * 32,
    restY: 3 + r() * 18,
    angle: `${100 + r() * 42}deg`,
    shineOp: 0.15 + r() * 0.12,
    specX,
    specY,
    fillX,
    fillY,
    peak: 0.46 + r() * 0.22,
    sizeA: `${150 + r() * 55}% ${150 + r() * 55}%`,
    sizeB: `${120 + r() * 50}% ${120 + r() * 50}%`,
    sizeC: `${160 + r() * 50}% ${160 + r() * 50}%`,
    fromA: `${specX + j(14)}% ${specY + 10 + j(10)}%`,
    fromB: `${fillX + 8 + j(10)}% ${fillY - 8 + j(10)}%`,
    fromC: `${streakX - 12 + j(10)}% ${streakY + 12 + j(8)}%`,
    toA: `${specX + j(8)}% ${specY + j(8)}%`,
    toB: `${fillX + j(8)}% ${fillY + j(8)}%`,
    toC: `${streakX + j(8)}% ${streakY + j(8)}%`,
    endA: `${specX + 10 + j(8)}% ${specY - 6 + j(8)}%`,
    endB: `${fillX - 6 + j(8)}% ${fillY + 8 + j(8)}%`,
    endC: `${streakX + 12 + j(8)}% ${streakY - 8 + j(8)}%`,
  };
}

export function followToward(
  pos: { x: number; y: number },
  target: { x: number; y: number },
  cfg = CARD_FOLLOW,
) {
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const dist = Math.hypot(dx, dy);
  const catchUp = cfg.near + Math.min(dist / cfg.range, 1) * (cfg.far - cfg.near);
  return { x: pos.x + dx * catchUp, y: pos.y + dy * catchUp };
}

export function cardTilt(moveX: number, moveY: number, cfg = CARD_TILT) {
  const tipX = Math.max(-1, Math.min(1, moveX / cfg.range));
  const tipY = Math.max(-1, Math.min(1, moveY / cfg.range));
  return {
    rotateZ: tipX * cfg.max,
    rotateX: -tipY * cfg.pitchMax,
    rotateY: tipX * cfg.yawMax,
  };
}

export function cardShine(light: CardLight, moveX: number, moveY: number, dragging: boolean) {
  if (!dragging) return { x: light.restX, y: light.restY };
  return {
    x: Math.max(48, Math.min(88, light.restX - moveX / 6)),
    y: Math.max(2, Math.min(28, light.restY + moveY / 8)),
  };
}

export function cardMoveTransform(moveX: number, moveY: number) {
  const { rotateX, rotateY, rotateZ } = cardTilt(moveX, moveY);
  return `translate(${moveX}px, ${moveY}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`;
}

export function cardLightVars(light: CardLight): CSSProperties {
  return {
    ['--shine-angle' as string]: light.angle,
    ['--shine-op' as string]: `${light.shineOp}`,
    ['--pop-peak' as string]: `${light.peak}`,
    ['--pop-spec' as string]: `${light.specX}% ${light.specY}%`,
    ['--pop-fill' as string]: `${light.fillX}% ${light.fillY}%`,
    ['--pop-size-a' as string]: light.sizeA,
    ['--pop-size-b' as string]: light.sizeB,
    ['--pop-size-c' as string]: light.sizeC,
    ['--pop-from-a' as string]: light.fromA,
    ['--pop-from-b' as string]: light.fromB,
    ['--pop-from-c' as string]: light.fromC,
    ['--pop-to-a' as string]: light.toA,
    ['--pop-to-b' as string]: light.toB,
    ['--pop-to-c' as string]: light.toC,
    ['--pop-end-a' as string]: light.endA,
    ['--pop-end-b' as string]: light.endB,
    ['--pop-end-c' as string]: light.endC,
  };
}

/**
 * Deterministic PRNG (Mulberry32) for reproducible simulations.
 * Returns a function that yields values in [0, 1).
 */
export function makeRng(seed: number | string): () => number {
  let state = typeof seed === "string" ? hashSeed(seed) : seed >>> 0;

  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0; // mulberry32
    let t = state >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

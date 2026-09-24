/* =========================================================================
   Utilities
   ========================================================================= */

export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const esc = s => String(s).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");

export function fmtN(n, d = 1) {
  if (!isFinite(n) || isNaN(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(d) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(d) + "K";
  return a < 10 ? n.toFixed(2) : n.toFixed(0);
}

export function fmtMs(ms) {
  if (ms < 1) return ms.toFixed(2) + "ms";
  if (ms < 1000) return ms.toFixed(1) + "ms";
  return (ms / 1000).toFixed(2) + "s";
}
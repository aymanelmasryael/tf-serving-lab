/* =========================================================================
   Collaboration Channel (BroadcastChannel)
   ========================================================================= */

export const NAMES = ["ada", "linus", "grace", "karpathy", "yann", "fei", "jeff", "ilya", "noor", "ravi", "mei", "tomas"];
export const COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#fb7185", "#60a5fa", "#f472b6", "#4ade80"];

function pick(a) {
  return a[Math.floor(Math.random() * a.length)];
}

export function createIdentity() {
  return {
    id: sessionStorage.getItem("tfs-id") || Math.random().toString(36).slice(2, 9),
    name: sessionStorage.getItem("tfs-name") || pick(NAMES) + "-" + Math.floor(Math.random() * 90 + 10),
    color: sessionStorage.getItem("tfs-color") || pick(COLORS),
    focus: null,
    self: true
  };
}

export function persistIdentity(me) {
  sessionStorage.setItem("tfs-id", me.id);
  sessionStorage.setItem("tfs-name", me.name);
  sessionStorage.setItem("tfs-color", me.color);
}

export function createChannel() {
  let chan = null;
  try {
    if ("BroadcastChannel" in window) {
      chan = new BroadcastChannel("tfs-lab");
    }
  } catch (_) { chan = null; }
  return chan;
}

export function postMessage(chan, msg, me) {
  if (!chan) return;
  try {
    chan.postMessage(Object.assign({ from: me.id, name: me.name, color: me.color, t: Date.now() }, msg));
  } catch (_) {}
}
/* =========================================================================
   Peer Presence Management
   ========================================================================= */

import { pick } from "./channel.js";

const AVATAR_INITIALS = n => n.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase();

export function createPeerMap() {
  return new Map();
}

export function handleMessage(peers, me, m, logFn, renderPresenceFn, applyRemotePatchFn, recompileContractFn) {
  if (!m || m.from === me.id) return;
  
  if (m.type === "bye") { 
    peers.delete(m.from); 
    renderPresenceFn(); 
    return; 
  }
  
  if (m.type === "presence" || m.type === "hello") {
    const existing = peers.get(m.from);
    peers.set(m.from, {
      id: m.from, name: m.name, color: m.color, focus: m.focus || null,
      activity: m.activity || "idle", lastSeen: Date.now(), demo: false
    });
    if (!existing && m.type === "hello") {
      logFn("sys", `peer ${m.name} joined the session`, "collab");
      // The caller will handle posting presence back
    }
    renderPresenceFn();
    return;
  }
  
  if (m.type === "state") { 
    applyRemotePatchFn(m.patch, m.name, m.color); 
    return; 
  }
  
  if (m.type === "log") { 
    logFn(m.level || "info", m.msg, m.src || "peer", m.name, m.color); 
    return; 
  }
  
  if (m.type === "contract") {
    // This will be handled by the caller since it needs access to S and contractSrc
  }
}

export function currentActivity(S, me) {
  if (S.running) return "training";
  if (me.focus === "contract") return "editing contract";
  if (me.focus === "infer") return "testing inference";
  if (me.focus === "train") return "tuning hyperparams";
  return "observing";
}

export function startPresenceHeartbeat(peers, me, chan, postFn, currentActivityFn, renderPresenceFn, S) {
  setInterval(() => {
    postFn({ type: "presence", focus: me.focus, activity: currentActivityFn() });
    const now = Date.now();
    let dirty = false;
    for (const [id, p] of peers) {
      if (!p.demo && now - p.lastSeen > 5200) { peers.delete(id); dirty = true; }
    }
    if (dirty) renderPresenceFn();
  }, 1600);
}

export function setupBeforeUnload(postFn) {
  window.addEventListener("beforeunload", () => postFn({ type: "bye" }));
}
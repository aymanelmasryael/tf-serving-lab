/* =========================================================================
   Logging
   ========================================================================= */

import { esc } from "./utils.js";

let logCount = 0;

export function log(level, msg, src = "rank0", who = null, color = null) {
  const logStream = document.getElementById("logStream");
  if (!logStream) return;
  
  const el = document.createElement("div");
  el.className = "log-line " + level;
  const t = new Date().toTimeString().slice(0, 8);
  const whoHtml = who ? `<span class="who" style="color:${color || "#7dd3fc"}">${esc(who)}</span> ` : "";
  el.innerHTML = `<span class="t">${t}</span><span class="s">[${esc(src)}]</span><span class="m">${whoHtml}${esc(msg)}</span>`;
  logStream.appendChild(el);
  if (++logCount > 260) { logStream.removeChild(logStream.firstChild); logCount--; }
  logStream.scrollTop = logStream.scrollHeight;
}

export function clearLogs() {
  const logStream = document.getElementById("logStream");
  if (!logStream) return;
  logStream.innerHTML = "";
  logCount = 0;
}
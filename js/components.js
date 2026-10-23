// components.js — Componentes UI reutilizables reales (funciones que devuelven HTML/DOM)
import { esc, initials } from "./utils.js";

export function Avatar({ name, size = "md", verified = false, ring = false }){
  const sizes = { sm: "36px", md: "44px", lg: "64px", xl: "96px" };
  const el = document.createElement("div");
  el.className = "avatar" + (size !== "md" ? " " + size : "");
  el.style.width = sizes[size] || sizes.md;
  el.style.height = sizes[size] || sizes.md;
  el.textContent = initials(name || "?");
  if(ring){
    const wrap = document.createElement("div");
    wrap.className = "avatar-ring";
    wrap.appendChild(el);
    return wrap;
  }
  return el;
}

export function VerifiedBadge(size = 14){
  const span = document.createElement("span");
  span.className = "verified-badge";
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="#3b82f6"><path d="M12 2l2.4 2.8 3.6-.4 1 3.4 3 2-1 3.4 1 3.4-3 2-1 3.4-3.6-.4L12 22l-2.4-2.8-3.6.4-1-3.4-3-2 1-3.4-1-3.4 3-2 1-3.4 3.6.4z"/><path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2" fill="none"/></svg>`;
  return span;
}

export function Toast(message, duration = 2500){
  let t = document.getElementById("toast");
  if(!t){
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = message;
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), duration);
}

export function Modal({ title, content, onClose }){
  const overlay = document.createElement("div");
  overlay.className = "modal";
  overlay.innerHTML = `<div class="modal-card">
    <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn close-modal">✕</button></div>
    <div class="modal-body"></div></div>`;
  const body = overlay.querySelector(".modal-body");
  if(typeof content === "string") body.innerHTML = content;
  else if(content instanceof Node) body.appendChild(content);
  overlay.querySelector(".close-modal").addEventListener("click", () => { overlay.remove(); if(onClose) onClose(); });
  overlay.addEventListener("click", e => { if(e.target === overlay){ overlay.remove(); if(onClose) onClose(); } });
  document.body.appendChild(overlay);
  return { close: () => overlay.remove(), body };
}

export function ConfirmDialog(message, onConfirm){
  return new Promise(resolve => {
    const m = Modal({
      title: "Confirmar",
      content: `<p style="margin:10px 0">${esc(message)}</p>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
          <button class="btn-ghost cancel-btn">Cancelar</button>
          <button class="btn-primary confirm-btn">Confirmar</button>
        </div>`
    });
    m.body.querySelector(".cancel-btn").addEventListener("click", () => { m.close(); resolve(false); });
    m.body.querySelector(".confirm-btn").addEventListener("click", () => { m.close(); resolve(true); if(onConfirm) onConfirm(); });
  });
}

export function Badge(count, max = 99){
  if(!count) return "";
  return `<span class="badge">${count > max ? max + "+" : count}</span>`;
}

export function Spinner(){
  const s = document.createElement("div");
  s.className = "spinner";
  return s;
}

export function EmptyState({ icon = "📭", title = "Vacío", subtitle = "" }){
  const div = document.createElement("div");
  div.className = "empty-state";
  div.innerHTML = `<div class="empty-icon">${icon}</div><h4>${esc(title)}</h4>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}`;
  return div;
}

export function Skeleton(count = 3){
  return Array(count).fill('<div class="skeleton"><div class="sk-line"></div><div class="sk-line short"></div></div>').join("");
}

export function ProgressBar(percent, color = "var(--primary)"){
  const wrap = document.createElement("div");
  wrap.className = "progress-bar";
  wrap.innerHTML = `<div class="progress-fill" style="width:${Math.min(100, Math.max(0, percent))}%;background:${color}"></div>`;
  return wrap;
}

export function Toggle({ checked = false, onChange }){
  const sw = document.createElement("div");
  sw.className = "switch" + (checked ? " on" : "");
  sw.addEventListener("click", () => {
    sw.classList.toggle("on");
    if(onChange) onChange(sw.classList.contains("on"));
  });
  return sw;
}

export function Tabs(tabs, onChange){
  const wrap = document.createElement("div");
  wrap.className = "tabs";
  tabs.forEach((t, i) => {
    const b = document.createElement("button");
    b.className = "tab-btn" + (i === 0 ? " active" : "");
    b.textContent = t.label;
    b.dataset.tab = t.id;
    b.addEventListener("click", () => {
      wrap.querySelectorAll(".tab-btn").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      if(onChange) onChange(t.id);
    });
    wrap.appendChild(b);
  });
  return wrap;
}

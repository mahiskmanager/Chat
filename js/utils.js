// utils.js — Utilidades funcionales reales para Inside
export const $ = id => document.getElementById(id);
export const $$ = sel => Array.from(document.querySelectorAll(sel));

export function esc(str){
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

export function convId(a, b){ return [a, b].sort().join("_"); }

export function avatarInitial(name){
  return (name || "?").trim().charAt(0).toUpperCase();
}

export function debounce(fn, ms){
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function throttle(fn, ms){
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if(now - last >= ms){ last = now; fn(...args); }
  };
}

export function truncate(str, n){
  return (str || "").length > n ? str.slice(0, n) + "…" : str;
}

export async function copyToClipboard(text){
  try { await navigator.clipboard.writeText(text); return true; }
  catch(e){
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); return true; } catch(_){ return false; }
    finally { ta.remove(); }
  }
}

export function downloadFile(filename, content, type = "text/plain"){
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function formatBytes(bytes){
  if(bytes === 0) return "0 B";
  const k = 1024, sizes = ["B","KB","MB","GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function generateId(prefix = "id"){
  return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

export function chunk(arr, size){
  const out = [];
  for(let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function unique(arr){ return Array.from(new Set(arr)); }

export function sortBy(arr, key, desc = false){
  return [...arr].sort((a, b) => {
    const va = a[key], vb = b[key];
    if(va < vb) return desc ? 1 : -1;
    if(va > vb) return desc ? -1 : 1;
    return 0;
  });
}

export function groupBy(arr, key){
  return arr.reduce((acc, item) => {
    const k = typeof key === "function" ? key(item) : item[key];
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {});
}

export function safeJSON(str, fallback = null){
  try { return JSON.parse(str); } catch(e){ return fallback; }
}

export function storageGet(key, fallback = null){
  try { const v = localStorage.getItem("inside_" + key); return v === null ? fallback : safeJSON(v, v); }
  catch(e){ return fallback; }
}

export function storageSet(key, value){
  try { localStorage.setItem("inside_" + key, JSON.stringify(value)); return true; }
  catch(e){ return false; }
}

export function storageRemove(key){
  try { localStorage.removeItem("inside_" + key); } catch(e){}
}

export function isOnline(){ return navigator.onLine; }

export function onNetworkChange(cb){
  window.addEventListener("online", () => cb(true));
  window.addEventListener("offline", () => cb(false));
}

export function escapeRegExp(str){
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlight(text, query){
  if(!query) return esc(text);
  const re = new RegExp("(" + escapeRegExp(query) + ")", "gi");
  return esc(text).replace(re, '<mark style="background:#fef08a;border-radius:3px;padding:0 2px">$1</mark>');
}

export function initials(name){
  return (name || "").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

export function contrastColor(hex){
  const c = hex.replace("#","");
  const r = parseInt(c.substr(0,2),16), g = parseInt(c.substr(2,2),16), b = parseInt(c.substr(4,2),16);
  return (r*0.299 + g*0.587 + b*0.114) > 186 ? "#000" : "#fff";
}

export function randomFrom(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

export function clamp(n, min, max){ return Math.min(Math.max(n, min), max); }

export function lerp(a, b, t){ return a + (b - a) * t; }

export function daysBetween(ts1, ts2){ return Math.abs(ts1 - ts2) / 86400000; }

export function isSameDay(ts1, ts2){
  const d1 = new Date(ts1), d2 = new Date(ts2);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

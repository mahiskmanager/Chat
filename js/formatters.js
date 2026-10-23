// formatters.js — Formateo real de fechas, horas, números y tiempos relativos
const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

export function formatTime(ts){
  if(!ts) return "";
  const d = new Date(ts);
  return d.getHours().toString().padStart(2,"0") + ":" + d.getMinutes().toString().padStart(2,"0");
}

export function formatDate(ts){
  if(!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.getDate() + " " + MONTHS_ES[d.getMonth()] + (sameYear ? "" : " " + d.getFullYear());
}

export function formatDateTime(ts){
  if(!ts) return "";
  return formatDate(ts) + " · " + formatTime(ts);
}

export function timeAgo(ts){
  if(!ts) return "hace un rato";
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if(sec < 60) return "ahora mismo";
  const min = Math.floor(sec / 60);
  if(min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if(hr < 24) return `hace ${hr} h`;
  const day = Math.floor(hr / 24);
  if(day < 7) return `hace ${day} d`;
  const wk = Math.floor(day / 7);
  if(wk < 5) return `hace ${wk} sem`;
  const mo = Math.floor(day / 30);
  if(mo < 12) return `hace ${mo} mes${mo > 1 ? "es" : ""}`;
  const yr = Math.floor(day / 365);
  return `hace ${yr} año${yr > 1 ? "s" : ""}`;
}

export function formatNumber(n){
  if(n === undefined || n === null) return "0";
  if(n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if(n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export function formatCount(n){
  return new Intl.NumberFormat("es").format(n || 0);
}

export function formatDuration(seconds){
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ":" + s.toString().padStart(2, "0");
}

export function formatFileSize(bytes){
  if(!bytes) return "0 B";
  const k = 1024, sizes = ["B","KB","MB","GB","TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function initials(name){
  return (name || "?").split(" ").filter(Boolean).slice(0,2).map(w => w[0].toUpperCase()).join("");
}

export function greeting(){
  const h = new Date().getHours();
  if(h < 6) return "Buenas noches";
  if(h < 12) return "Buenos días";
  if(h < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function isToday(ts){
  const d = new Date(ts), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export function isYesterday(ts){
  const d = new Date(ts), n = new Date();
  const y = new Date(n); y.setDate(n.getDate() - 1);
  return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate();
}

export function chatDateLabel(ts){
  if(isToday(ts)) return "Hoy";
  if(isYesterday(ts)) return "Ayer";
  return formatDate(ts);
}

export function maskEmail(email){
  const [user, domain] = String(email || "").split("@");
  if(!domain) return email;
  return user.slice(0,2) + "•••@" + domain;
}

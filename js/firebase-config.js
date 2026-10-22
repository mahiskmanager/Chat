// Inside — Configuración central de Firebase + utilidades
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEE5fVYD8uAPV_r8uK4bEGBZDlQlBnKsY",
  authDomain: "inside-30b7d.firebaseapp.com",
  databaseURL: "https://inside-30b7d-default-rtdb.firebaseio.com",
  projectId: "inside-30b7d",
  storageBucket: "inside-30b7d.firebasestorage.app",
  messagingSenderId: "322776562224",
  appId: "1:322776562224:web:77ddfbd269c705d49e8bf5",
  measurementId: "G-SF29F8WMR5"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

export function avatarInitial(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function formatTime(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return "";
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return "Hoy · " + formatTime(ts);
  const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return "Ayer · " + formatTime(ts);
  return d.toLocaleDateString([], { day: "2-digit", month: "short" }) + " · " + formatTime(ts);
}

// Palomita azul de verificado (SVG inline)
export function verifiedBadge(size = 14) {
  return `<svg class="verified" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-label="Verificado">
    <circle cx="12" cy="12" r="11" fill="#1d9bf0"/>
    <path d="M8.5 12.5l2.2 2.2 4.8-5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`;
}

export function showAlert(el, type, text) {
  el.textContent = text;
  el.className = "alert " + type;
}

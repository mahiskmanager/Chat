// emoji-picker.js — Selector de emojis real con categorías y búsqueda
import { EMOJIS, EMOJI_CATEGORIES } from "./constants.js";
import { $ } from "./utils.js";

let currentCategory = "smileys";
let onSelectCallback = null;
let searchQuery = "";

export function openEmojiPicker(targetInput, onSelect){
  onSelectCallback = onSelect;
  let picker = $("emojiPickerModal");
  if(!picker){
    picker = document.createElement("div");
    picker.id = "emojiPickerModal";
    picker.className = "emoji-picker-modal hidden";
    document.body.appendChild(picker);
  }
  picker.innerHTML = renderPicker();
  picker.classList.remove("hidden");
  bindPickerEvents(picker, targetInput);
}

export function closeEmojiPicker(){
  const p = $("emojiPickerModal");
  if(p) p.classList.add("hidden");
}

function renderPicker(){
  const cats = EMOJI_CATEGORIES.map(c =>
    `<button class="ep-cat ${c.id === currentCategory ? "active" : ""}" data-cat="${c.id}" title="${c.name}">${c.icon}</button>`
  ).join("");
  const list = getFilteredEmojis().map(e => `<button class="ep-emoji" data-emoji="${e}">${e}</button>`).join("");
  return `<div class="ep-window">
    <div class="ep-header">
      <input type="text" class="ep-search" placeholder="🔍 Buscar emoji…" value="${searchQuery}">
    </div>
    <div class="ep-cats">${cats}</div>
    <div class="ep-grid">${list || '<p style="grid-column:1/-1;text-align:center;color:#94a3b8;padding:20px">Sin resultados</p>'}</div>
  </div>`;
}

function getFilteredEmojis(){
  const all = EMOJIS[currentCategory] || [];
  if(!searchQuery) return all;
  const q = searchQuery.toLowerCase();
  return all.filter(e => e.includes(q));
}

function bindPickerEvents(picker, targetInput){
  picker.querySelector(".ep-search").addEventListener("input", e => {
    searchQuery = e.target.value;
    picker.querySelector(".ep-grid").outerHTML = `<div class="ep-grid">${getFilteredEmojis().map(em => `<button class="ep-emoji" data-emoji="${em}">${em}</button>`).join("")}</div>`;
    bindEmojiClicks(picker, targetInput);
  });
  picker.querySelectorAll(".ep-cat").forEach(btn => btn.addEventListener("click", () => {
    currentCategory = btn.dataset.cat;
    searchQuery = "";
    picker.querySelector(".ep-search").value = "";
    picker.querySelectorAll(".ep-cat").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    picker.querySelector(".ep-grid").outerHTML = `<div class="ep-grid">${(EMOJIS[currentCategory] || []).map(em => `<button class="ep-emoji" data-emoji="${em}">${em}</button>`).join("")}</div>`;
    bindEmojiClicks(picker, targetInput);
  }));
  bindEmojiClicks(picker, targetInput);
  picker.addEventListener("click", e => { if(e.target === picker) closeEmojiPicker(); });
}

function bindEmojiClicks(picker, targetInput){
  picker.querySelectorAll(".ep-emoji").forEach(btn => btn.addEventListener("click", () => {
    const emoji = btn.dataset.emoji;
    if(targetInput){
      const inp = typeof targetInput === "string" ? $(targetInput) : targetInput;
      if(inp){ inp.value += emoji; inp.focus(); }
    }
    if(onSelectCallback) onSelectCallback(emoji);
    closeEmojiPicker();
  }));
}

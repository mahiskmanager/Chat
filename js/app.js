// Inside v2.0 — Feed, amigos, solicitudes, DM, búsqueda, perfil + verificado
import { auth, db, avatarInitial, formatTime, formatDate, verifiedBadge } from "./firebase-config.js";
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {
  ref, set, push, update, remove, onValue, onChildAdded, get,
  serverTimestamp, query, orderByChild, limitToLast, onDisconnect
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";

let me = null, myProfile = null, friends = {}, usersCache = {}, onlineUsers = {};
let activeConv = null, activeConvId = null, unsubDm = null, unsubTyping = null;
let loadedMsgIds = new Set();

const $ = (id) => document.getElementById(id);
const esc = (s) => { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; };
const convId = (a, b) => [a, b].sort().join("_");
const toast = (msg) => { const t = $("toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.add("hidden"), 2500); };
const vBadge = (u) => u && u.verified ? verifiedBadge(14) : "";

onAuthStateChanged(auth, (user) => { if (!user) { location.replace("index.html"); return; } me = user; init(); });
$("logoutBtn").addEventListener("click", async () => {
  if (activeConvId) await remove(ref(db, `typing/private/${activeConvId}/${me.uid}`)).catch(() => {});
  await signOut(auth);
});

async function init() {
  await loadMyProfile();
  setupPresence(); setupNav(); setupOnlineCounter();
  setupFriends(); setupRequestsBadge(); setupFeed(); setupPostComposer();
  setupSearch(); setupProfileEdit(); setupChatUI();
  renderProfile(); loadMyPosts(); renderStories();
}

async function loadMyProfile() {
  const snap = await get(ref(db, "users/" + me.uid));
  myProfile = snap.val() || {};
  const name = myProfile.name || me.displayName || me.email.split("@")[0];
  $("sideName").innerHTML = esc(name) + vBadge(myProfile);
  $("sideEmail").textContent = me.email;
  $("sideAvatar").textContent = avatarInitial(name);
  $("feedAvatar").textContent = avatarInitial(name);
  if (!snap.exists()) await set(ref(db, "users/" + me.uid), { name, bio: "", email: me.email, createdAt: Date.now(), verified: false });
}

function setupPresence() {
  const name = myProfile.name || me.email.split("@")[0];
  const myRef = ref(db, "presence/" + me.uid);
  set(myRef, { name, online: true });
  onDisconnect(myRef).remove();
}

function setupOnlineCounter() {
  onValue(ref(db, "presence"), (snap) => {
    onlineUsers = snap.val() || {};
    const n = Object.keys(onlineUsers).length;
    $("topOnline").textContent = n + (n === 1 ? " en línea" : " en línea");
    if (activeConv) updateConvStatus();
  });
}

function setupNav() {
  const titles = { feed: "Inicio", chats: "Mensajes", people: "Buscar", requests: "Solicitudes", profile: "Mi Perfil" };
  document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    $("view-" + btn.dataset.view).classList.add("active");
    $("topTitle").textContent = titles[btn.dataset.view];
    $("sidebar").classList.remove("open");
    if (btn.dataset.view === "people") renderFriends();
    if (btn.dataset.view === "requests") renderRequests();
    if (btn.dataset.view === "profile") { renderProfile(); loadMyPosts(); }
  }));
  $("menuToggle").addEventListener("click", () => $("sidebar").classList.toggle("open"));
}

function setupFriends() {
  onValue(ref(db, "friends/" + me.uid), (snap) => {
    friends = snap.val() || {};
    renderFriends(); renderDmList(); renderStories();
    $("statFriends").textContent = Object.keys(friends).length;
  });
  onValue(ref(db, "users"), (snap) => {
    usersCache = snap.val() || {};
    renderFriends(); renderDmList(); renderStories();
    if (activeConv) { const u = usersCache[activeConv]; if (u) { $("convName").innerHTML = esc(u.name) + vBadge(u); $("convAvatar").textContent = avatarInitial(u.name); } }
  });
}

function renderStories() {
  const list = Object.keys(friends).map(uid => [uid, usersCache[uid] || { name: "Usuario" }]).slice(0, 10);
  if (!list.length) { $("stories").innerHTML = ""; return; }
  $("stories").innerHTML = list.map(([uid, u]) => `
    <div class="story" onclick="openChat('${uid}')">
      <div class="avatar-ring"><div class="avatar sm">${esc(avatarInitial(u.name))}</div></div>
      <span>${esc((u.name || "").split(" ")[0])}</span>
    </div>`).join("");
}

async function sendFriendRequest(uid) {
  const target = usersCache[uid];
  const myName = myProfile.name || me.email.split("@")[0];
  await set(ref(db, `friendRequests/incoming/${uid}/${me.uid}`), { fromUid: me.uid, name: myName, timestamp: Date.now() });
  await set(ref(db, `friendRequests/sent/${me.uid}/${uid}`), { toUid: uid, name: target?.name || "Usuario", timestamp: Date.now() });
  toast("Solicitud enviada"); renderFriends();
}
async function cancelFriendRequest(uid) {
  await remove(ref(db, `friendRequests/incoming/${uid}/${me.uid}`)).catch(() => {});
  await remove(ref(db, `friendRequests/sent/${me.uid}/${uid}`)).catch(() => {});
  toast("Solicitud cancelada"); renderFriends();
}
async function acceptFriendRequest(uid) {
  const upd = {};
  upd[`friends/${me.uid}/${uid}`] = true; upd[`friends/${uid}/${me.uid}`] = true;
  upd[`friendRequests/incoming/${me.uid}/${uid}`] = null; upd[`friendRequests/sent/${uid}/${me.uid}`] = null;
  await update(ref(db), upd);
  toast("¡Ahora son amigos!"); renderRequests(); renderFriends();
}
async function declineFriendRequest(uid) {
  const upd = {};
  upd[`friendRequests/incoming/${me.uid}/${uid}`] = null; upd[`friendRequests/sent/${uid}/${me.uid}`] = null;
  await update(ref(db), upd);
  toast("Solicitud rechazada"); renderRequests();
}
window.acceptReq = acceptFriendRequest; window.declineReq = declineFriendRequest; window.cancelReq = cancelFriendRequest;

function setupRequestsBadge() {
  onValue(ref(db, "friendRequests/incoming/" + me.uid), (snap) => {
    const n = snap.numChildren(); const b = $("reqBadge");
    if (n > 0) { b.textContent = n; b.classList.remove("hidden"); } else b.classList.add("hidden");
  });
}

function renderRequests() {
  get(ref(db, "friendRequests/incoming/" + me.uid)).then(snap => {
    const list = Object.values(snap.val() || {});
    $("incomingList").innerHTML = list.length ? list.map(r => `
      <div class="user-card">
        <div class="avatar sm">${esc(avatarInitial(r.name))}</div>
        <div class="uc-info"><span class="uc-name">${esc(r.name)}</span><span class="uc-meta">Quiere ser tu amigo</span></div>
        <div class="uc-actions"><button class="btn-ghost" onclick="acceptReq('${r.fromUid}')">Aceptar</button><button class="btn-danger-ghost" onclick="declineReq('${r.fromUid}')">✕</button></div>
      </div>`).join("") : '<p class="empty">No tienes solicitudes pendientes</p>';
  });
  get(ref(db, "friendRequests/sent/" + me.uid)).then(snap => {
    const list = Object.values(snap.val() || {});
    $("sentList").innerHTML = list.length ? list.map(r => `
      <div class="user-card">
        <div class="avatar sm">${esc(avatarInitial(r.name))}</div>
        <div class="uc-info"><span class="uc-name">${esc(r.name)}</span><span class="uc-meta">Pendiente de aceptación</span></div>
        <div class="uc-actions"><button class="btn-danger-ghost" onclick="cancelReq('${r.toUid}')">Cancelar</button></div>
      </div>`).join("") : '<p class="empty">No has enviado solicitudes</p>';
  });
}

function setupSearch() {
  $("searchInput").addEventListener("input", () => {
    const q = $("searchInput").value.trim().toLowerCase();
    const results = Object.entries(usersCache).filter(([uid]) => uid !== me.uid)
      .filter(([, u]) => (u.name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)).slice(0, 20);
    renderSearchResults(results);
  });
}
function renderSearchResults(results) {
  $("searchResults").innerHTML = results.length ? results.map(([uid, u]) => userCard(uid, u)).join("") : '<p class="empty">Sin resultados</p>';
}
function userCard(uid, u) {
  const name = u.name || "Usuario";
  const isFriend = friends[uid];
  const online = onlineUsers[uid];
  const actions = isFriend
    ? `<span class="status-pill ${online ? "online" : ""}">${online ? "En línea" : "Amigo"}</span><button class="btn-ghost" onclick="openChat('${uid}')">Mensaje</button>`
    : `<button class="btn-ghost" onclick="sendReq('${uid}')">Agregar</button>`;
  return `<div class="user-card">
    <div class="avatar sm">${esc(avatarInitial(name))}</div>
    <div class="uc-info"><span class="uc-name">${esc(name)}${vBadge(u)}</span><span class="uc-meta">${esc(u.email || "")}</span></div>
    <div class="uc-actions">${actions}</div>
  </div>`;
}
window.sendReq = sendFriendRequest;
window.openChat = (uid) => { document.querySelector('[data-view="chats"]').click(); openConversation(uid); };

function renderFriends() {
  const list = Object.keys(friends).map(uid => [uid, usersCache[uid] || { name: "Usuario" }]);
  $("friendsList").innerHTML = list.length ? list.map(([uid, u]) => userCard(uid, u)).join("") : '<p class="empty">Aún no tienes amigos. Busca personas arriba.</p>';
}

function setupFeed() {
  onValue(ref(db, "posts"), (snap) => {
    const posts = Object.entries(snap.val() || {}).map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 50);
    renderPosts($("feedList"), posts);
  });
}
function renderPosts(container, posts) {
  if (!posts.length) { container.innerHTML = '<p class="empty">No hay publicaciones todavía. ¡Sé el primero!</p>'; return; }
  container.innerHTML = posts.map(p => {
    const likes = p.likes || {}; const liked = !!likes[me.uid]; const likeCount = Object.keys(likes).length;
    const mine = p.uid === me.uid;
    const author = usersCache[p.uid] || { name: p.name };
    return `<article class="post">
      <div class="post-head">
        <div class="${author.verified ? "avatar-ring" : ""}"><div class="avatar sm">${esc(avatarInitial(p.name || "?"))}</div></div>
        <div><span class="post-author">${esc(p.name || "Usuario")}${vBadge(author)}</span><span class="post-time">${p.timestamp ? formatDate(p.timestamp) : ""}</span></div>
      </div>
      <div class="post-text">${esc(p.text)}</div>
      <div class="post-actions">
        <button class="like-btn ${liked ? "liked" : ""}" onclick="toggleLike('${p.id}')">${liked ? "❤️" : "🤍"} <span>${likeCount}</span></button>
        ${mine ? `<button class="delete-post" onclick="deletePost('${p.id}')">🗑 Eliminar</button>` : ""}
      </div>
    </article>`;
  }).join("");
}
window.toggleLike = async (postId) => {
  const r = ref(db, `posts/${postId}/likes/${me.uid}`);
  const s = await get(r); if (s.exists()) await remove(r); else await set(r, true);
};
window.deletePost = async (postId) => { if (!confirm("¿Eliminar esta publicación?")) return; await remove(ref(db, "posts/" + postId)); toast("Publicación eliminada"); };

function setupPostComposer() {
  const ta = $("postInput");
  ta.addEventListener("input", () => $("postCount").textContent = ta.value.length + "/500");
  $("postBtn").addEventListener("click", async () => {
    const text = ta.value.trim(); if (!text) return;
    const myName = myProfile.name || me.email.split("@")[0];
    await set(push(ref(db, "posts")), { uid: me.uid, name: myName, text, timestamp: serverTimestamp() });
    ta.value = ""; $("postCount").textContent = "0/500"; toast("Publicado ✅");
  });
}

function setupChatUI() {
  $("newChatBtn").addEventListener("click", () => {
    const list = Object.keys(friends);
    $("modalFriendList").innerHTML = list.length ? list.map(uid => {
      const u = usersCache[uid] || { name: "Usuario" };
      return `<div class="dm-item" onclick="openChat('${uid}');closeModal()">
        <div class="avatar sm">${esc(avatarInitial(u.name))}</div>
        <div class="dm-info"><span class="dm-name">${esc(u.name)}${vBadge(u)}</span></div></div>`;
    }).join("") : '<p class="empty">Agrega amigos primero</p>';
    $("friendModal").classList.remove("hidden");
  });
  $("closeModal").addEventListener("click", closeModal);
  $("friendModal").addEventListener("click", e => { if (e.target.id === "friendModal") closeModal(); });
  $("convBack").addEventListener("click", () => { $("chatConvPanel").classList.remove("open"); closeConversation(); });
  $("dmComposer").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = $("dmInput").value.trim(); if (!text || !activeConv) return;
    const myName = myProfile.name || me.email.split("@")[0];
    await set(push(ref(db, "messages/private/" + activeConvId)), { fromUid: me.uid, toUid: activeConv, name: myName, text, timestamp: serverTimestamp(), read: false });
    $("dmInput").value = ""; removeTyping();
  });
  $("dmInput").addEventListener("input", () => {
    if (!activeConvId) return;
    if (!$("dmInput").value.trim()) { removeTyping(); return; }
    set(ref(db, `typing/private/${activeConvId}/${me.uid}`), { name: myProfile.name || me.email.split("@")[0] });
    clearTimeout($("dmInput")._t); $("dmInput")._t = setTimeout(removeTyping, 2000);
  });
  $("dmInput").addEventListener("blur", removeTyping);
}
window.closeModal = () => $("friendModal").classList.add("hidden");
function removeTyping() { if (activeConvId) remove(ref(db, `typing/private/${activeConvId}/${me.uid}`)).catch(() => {}); }

async function renderDmList() {
  const fids = Object.keys(friends);
  if (!fids.length) { $("dmList").innerHTML = '<p class="empty">Agrega amigos para chatear</p>'; return; }
  const items = await Promise.all(fids.map(async (uid) => {
    const cid = convId(me.uid, uid);
    const s = await get(query(ref(db, "messages/private/" + cid), orderByChild("timestamp"), limitToLast(1)));
    let last = "", unread = 0, lastTime = 0;
    s.forEach(m => { const v = m.val(); last = v.text; lastTime = v.timestamp || 0; });
    const all = await get(ref(db, "messages/private/" + cid));
    all.forEach(m => { const v = m.val(); if (v.toUid === me.uid && !v.read) unread++; });
    return { uid, last, unread, lastTime };
  }));
  items.sort((a, b) => b.lastTime - a.lastTime);
  $("dmList").innerHTML = items.map(it => {
    const u = usersCache[it.uid] || { name: "Usuario" };
    return `<div class="dm-item ${activeConv === it.uid ? "active" : ""}" onclick="openConversation('${it.uid}')">
      <div class="${u.verified ? "avatar-ring" : ""}"><div class="avatar sm">${esc(avatarInitial(u.name))}</div></div>
      <div class="dm-info"><span class="dm-name">${esc(u.name)}${vBadge(u)}</span><span class="dm-last">${esc(it.last || "Sin mensajes")}</span></div>
      ${it.unread ? `<span class="dm-unread">${it.unread}</span>` : ""}
    </div>`;
  }).join("");
}

window.openConversation = async (uid) => {
  if (unsubDm) unsubDm(); if (unsubTyping) unsubTyping();
  removeTyping();
  activeConv = uid; activeConvId = convId(me.uid, uid); loadedMsgIds.clear();
  const u = usersCache[uid] || { name: "Usuario" };
  $("convName").innerHTML = esc(u.name) + vBadge(u);
  $("convAvatar").textContent = avatarInitial(u.name);
  updateConvStatus();
  $("convPlaceholder").classList.add("hidden");
  $("convActive").classList.remove("hidden");
  $("chatConvPanel").classList.add("open");
  $("dmMessages").innerHTML = "";
  const all = await get(ref(db, "messages/private/" + activeConvId));
  const upd = {};
  all.forEach(m => { const v = m.val(); if (v.toUid === me.uid && !v.read) upd[`messages/private/${activeConvId}/${m.key}/read`] = true; });
  if (Object.keys(upd).length) await update(ref(db), upd);
  unsubDm = onChildAdded(query(ref(db, "messages/private/" + activeConvId), orderByChild("timestamp"), limitToLast(100)), (snap) => {
    if (loadedMsgIds.has(snap.key)) return;
    loadedMsgIds.add(snap.key);
    renderDmMessage(snap.val());
    $("dmMessages").scrollTop = $("dmMessages").scrollHeight;
    const v = snap.val();
    if (v.toUid === me.uid && !v.read) update(ref(db, `messages/private/${activeConvId}/${snap.key}`), { read: true });
  });
  unsubTyping = onValue(ref(db, "typing/private/" + activeConvId), (snap) => {
    const other = Object.entries(snap.val() || {}).find(([id]) => id !== me.uid);
    if (other) { $("dmTypingName").textContent = other[1].name + " está escribiendo"; $("dmTyping").hidden = false; }
    else $("dmTyping").hidden = true;
  });
  renderDmList();
};
function closeConversation() {
  removeTyping();
  if (unsubDm) { unsubDm(); unsubDm = null; }
  if (unsubTyping) { unsubTyping(); unsubTyping = null; }
  activeConv = null; activeConvId = null;
  $("convActive").classList.add("hidden"); $("convPlaceholder").classList.remove("hidden");
}
function updateConvStatus() {
  if (!activeConv) return;
  const el = $("convStatus");
  if (onlineUsers[activeConv]) { el.textContent = "En línea"; el.classList.remove("off"); }
  else { el.textContent = "Desconectado"; el.classList.add("off"); }
}
function renderDmMessage(msg) {
  const isMe = msg.fromUid === me.uid;
  const row = document.createElement("div");
  row.className = "msg-row" + (isMe ? " me" : "");
  row.innerHTML = `<div class="avatar msg-avatar">${esc(avatarInitial(msg.name))}</div>
    <div class="bubble"><span>${esc(msg.text)}</span><span class="msg-time">${msg.timestamp ? formatTime(msg.timestamp) : ""}</span></div>`;
  $("dmMessages").appendChild(row);
}

function renderProfile() {
  const name = myProfile.name || me.email.split("@")[0];
  $("profileName").innerHTML = esc(name) + vBadge(myProfile);
  $("profileEmail").textContent = me.email;
  $("profileBio").textContent = myProfile.bio || "Sin biografía";
  $("profileAvatar").textContent = avatarInitial(name);
  $("editName").value = name;
  $("editBio").value = myProfile.bio || "";
  $("statSince").textContent = myProfile.createdAt ? new Date(myProfile.createdAt).toLocaleDateString() : "—";
}
function setupProfileEdit() {
  $("saveProfileBtn").addEventListener("click", async () => {
    const name = $("editName").value.trim() || me.email.split("@")[0];
    const bio = $("editBio").value.trim();
    await update(ref(db, "users/" + me.uid), { name, bio });
    await updateProfile(me, { displayName: name }).catch(() => {});
    myProfile.name = name; myProfile.bio = bio;
    $("sideName").innerHTML = esc(name) + vBadge(myProfile);
    $("sideAvatar").textContent = avatarInitial(name);
    $("feedAvatar").textContent = avatarInitial(name);
    renderProfile();
    $("saveOk").classList.remove("hidden");
    setTimeout(() => $("saveOk").classList.add("hidden"), 2000);
    toast("Perfil actualizado ✅");
  });
}
function loadMyPosts() {
  onValue(ref(db, "posts"), (snap) => {
    const mine = Object.entries(snap.val() || {}).map(([id, p]) => ({ id, ...p }))
      .filter(p => p.uid === me.uid).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    $("statPosts").textContent = mine.length;
    renderPosts($("myPosts"), mine);
  });
}

// Inside v3.0 — App completa: feed, comentarios, historias, notificaciones, guardados, DM, perfil, reportes, bloqueo, tema oscuro
import { auth, db, avatarInitial, formatTime, formatDate, timeAgo, verifiedBadge, EMOJIS, applyTheme, toggleTheme } from "./firebase-config.js";
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { ref, set, push, update, remove, onValue, onChildAdded, get, serverTimestamp, query, orderByChild, limitToLast, onDisconnect } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";

let me=null, myProfile=null, friends={}, usersCache={}, onlineUsers={}, blocked={};
let activeConv=null, activeConvId=null, unsubDm=null, unsubTyping=null, loadedMsgIds=new Set();
let emojiTarget=null, reportTarget=null, reportType=null;

const $=id=>document.getElementById(id);
const esc=s=>{const d=document.createElement("div");d.textContent=s??"";return d.innerHTML;};
const convId=(a,b)=>[a,b].sort().join("_");
const vBadge=u=>u&&u.verified?verifiedBadge(14):"";
const toast=msg=>{const t=$("toast");t.textContent=msg;t.classList.remove("hidden");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.add("hidden"),2500);};

applyTheme();

onAuthStateChanged(auth,async user=>{
  if(!user){location.replace("index.html");return;}
  me=user;
  const u=await get(ref(db,"users/"+me.uid));
  if(u.exists()&&u.val().banned){await signOut(auth);location.replace("index.html");return;}
  init();
});
$("logoutBtn").addEventListener("click",async()=>{if(activeConvId)await remove(ref(db,`typing/private/${activeConvId}/${me.uid}`)).catch(()=>{});await signOut(auth);});
$("themeBtn").addEventListener("click",()=>{toggleTheme();$("themeBtn").textContent=document.body.classList.contains("dark")?"☀️":"🌙";});

async function init(){
  await loadMyProfile();
  setupPresence();setupNav();setupOnlineCounter();setupFriends();setupRequestsBadge();
  setupFeed();setupPostComposer();setupSearch();setupProfileEdit();setupChatUI();
  setupStories();setupNotifications();setupSaved();setupAnnouncement();setupEmojiPicker();
  setupBlock();renderProfile();loadMyPosts();
  $("themeBtn").textContent=document.body.classList.contains("dark")?"☀️":"🌙";
}

async function loadMyProfile(){
  const snap=await get(ref(db,"users/"+me.uid));
  myProfile=snap.val()||{};
  const name=myProfile.name||me.displayName||me.email.split("@")[0];
  $("sideName").innerHTML=esc(name)+vBadge(myProfile);
  $("sideEmail").textContent=me.email;
  $("sideAvatar").textContent=avatarInitial(name);
  $("feedAvatar").textContent=avatarInitial(name);
  if(!snap.exists())await set(ref(db,"users/"+me.uid),{name,bio:"",email:me.email,createdAt:Date.now(),verified:false,banned:false});
}
function setupPresence(){
  const name=myProfile.name||me.email.split("@")[0];
  const myRef=ref(db,"presence/"+me.uid);
  set(myRef,{name,online:true});
  onDisconnect(myRef).remove();
}
function setupOnlineCounter(){
  onValue(ref(db,"presence"),snap=>{
    onlineUsers=snap.val()||{};
    const n=Object.keys(onlineUsers).length;
    $("topOnline").textContent=n+(n===1?" en línea":" en línea");
    if(activeConv)updateConvStatus();
  });
}
function setupNav(){
  const titles={feed:"Inicio",chats:"Mensajes",people:"Buscar",requests:"Solicitudes",notifications:"Notificaciones",saved:"Guardados",profile:"Mi Perfil"};
  document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>{
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    $("view-"+btn.dataset.view).classList.add("active");
    $("topTitle").textContent=titles[btn.dataset.view];
    $("sidebar").classList.remove("open");
    if(btn.dataset.view==="people")renderFriends();
    if(btn.dataset.view==="requests")renderRequests();
    if(btn.dataset.view==="notifications"){renderNotifications();markNotifRead();}
    if(btn.dataset.view==="saved")renderSaved();
    if(btn.dataset.view==="profile"){renderProfile();loadMyPosts();}
  }));
  $("menuToggle").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
}
function setupFriends(){
  onValue(ref(db,"friends/"+me.uid),snap=>{friends=snap.val()||{};renderFriends();renderDmList();renderSuggestions();$("statFriends").textContent=Object.keys(friends).length;});
  onValue(ref(db,"blocked/"+me.uid),snap=>{blocked=snap.val()||{};});
  onValue(ref(db,"users"),snap=>{
    usersCache=snap.val()||{};
    renderFriends();renderDmList();renderSuggestions();
    if(activeConv){const u=usersCache[activeConv];if(u){$("convName").innerHTML=esc(u.name)+vBadge(u);$("convAvatar").textContent=avatarInitial(u.name);}}
  });
}

// ===== Amistades =====
async function sendFriendRequest(uid){
  const myName=myProfile.name||me.email.split("@")[0];
  await set(ref(db,`friendRequests/incoming/${uid}/${me.uid}`),{fromUid:me.uid,name:myName,timestamp:Date.now()});
  await set(ref(db,`friendRequests/sent/${me.uid}/${uid}`),{toUid:uid,name:usersCache[uid]?.name||"Usuario",timestamp:Date.now()});
  await pushNotif(uid,`${myName} te envió una solicitud de amistad`,"🤝");
  toast("Solicitud enviada");renderFriends();renderSuggestions();
}
async function cancelFriendRequest(uid){
  await remove(ref(db,`friendRequests/incoming/${uid}/${me.uid}`)).catch(()=>{});
  await remove(ref(db,`friendRequests/sent/${me.uid}/${uid}`)).catch(()=>{});
  toast("Solicitud cancelada");renderFriends();renderSuggestions();
}
async function acceptFriendRequest(uid){
  const upd={};
  upd[`friends/${me.uid}/${uid}`]=true;upd[`friends/${uid}/${me.uid}`]=true;
  upd[`friendRequests/incoming/${me.uid}/${uid}`]=null;upd[`friendRequests/sent/${uid}/${me.uid}`]=null;
  await update(ref(db),upd);
  await pushNotif(uid,`${myProfile.name} aceptó tu solicitud de amistad`,"✅");
  toast("¡Ahora son amigos!");renderRequests();renderFriends();renderSuggestions();
}
async function declineFriendRequest(uid){
  const upd={};upd[`friendRequests/incoming/${me.uid}/${uid}`]=null;upd[`friendRequests/sent/${uid}/${me.uid}`]=null;
  await update(ref(db),upd);toast("Solicitud rechazada");renderRequests();
}
window.acceptReq=acceptFriendRequest;window.declineReq=declineFriendRequest;window.cancelReq=cancelFriendRequest;
window.sendReq=sendFriendRequest;
window.openChat=uid=>{document.querySelector('[data-view="chats"]').click();openConversation(uid);};

function setupRequestsBadge(){
  onValue(ref(db,"friendRequests/incoming/"+me.uid),snap=>{const n=snap.numChildren();const b=$("reqBadge");if(n>0){b.textContent=n;b.classList.remove("hidden");}else b.classList.add("hidden");});
}
function renderRequests(){
  get(ref(db,"friendRequests/incoming/"+me.uid)).then(snap=>{
    const list=Object.values(snap.val()||{});
    $("incomingList").innerHTML=list.length?list.map(r=>`<div class="user-card">
      <div class="avatar sm">${esc(avatarInitial(r.name))}</div>
      <div class="uc-info" onclick="openUserModal('${r.fromUid}')"><span class="uc-name">${esc(r.name)}</span><span class="uc-meta">Quiere ser tu amigo</span></div>
      <div class="uc-actions"><button class="btn-ghost" onclick="acceptReq('${r.fromUid}')">Aceptar</button><button class="btn-danger-ghost" onclick="declineReq('${r.fromUid}')">✕</button></div>
    </div>`).join(""):'<p class="empty">No tienes solicitudes pendientes</p>';
  });
  get(ref(db,"friendRequests/sent/"+me.uid)).then(snap=>{
    const list=Object.values(snap.val()||{});
    $("sentList").innerHTML=list.length?list.map(r=>`<div class="user-card">
      <div class="avatar sm">${esc(avatarInitial(r.name))}</div>
      <div class="uc-info" onclick="openUserModal('${r.toUid}')"><span class="uc-name">${esc(r.name)}</span><span class="uc-meta">Pendiente de aceptación</span></div>
      <div class="uc-actions"><button class="btn-danger-ghost" onclick="cancelReq('${r.toUid}')">Cancelar</button></div>
    </div>`).join(""):'<p class="empty">No has enviado solicitudes</p>';
  });
}

// ===== Búsqueda y usuarios =====
function setupSearch(){
  $("searchInput").addEventListener("input",()=>{
    const q=$("searchInput").value.trim().toLowerCase();
    const results=Object.entries(usersCache).filter(([uid])=>uid!==me.uid&&!blocked[uid])
      .filter(([,u])=>(u.name||"").toLowerCase().includes(q)||(u.email||"").toLowerCase().includes(q)).slice(0,20);
    renderSearchResults(results);
  });
}
function renderSearchResults(results){
  $("searchResults").innerHTML=results.length?results.map(([uid,u])=>userCard(uid,u)).join(""):'<p class="empty">Sin resultados</p>';
}
function renderSuggestions(){
  const sugg=Object.entries(usersCache).filter(([uid])=>uid!==me.uid&&!friends[uid]&&!blocked[uid])
    .filter(([,u])=>{
      // no tiene solicitud pendiente de mí
      return true;
    }).slice(0,6);
  $("suggestList").innerHTML=sugg.length?sugg.map(([uid,u])=>userCard(uid,u)).join(""):'<p class="empty">No hay sugerencias</p>';
}
function userCard(uid,u){
  const name=u.name||"Usuario";
  const isFriend=friends[uid];
  const online=onlineUsers[uid];
  let actions;
  if(isFriend)actions=`<span class="status-pill ${online?"online":""}">${online?"En línea":"Amigo"}</span><button class="btn-ghost" onclick="openChat('${uid}')">Mensaje</button>`;
  else actions=`<button class="btn-ghost" onclick="sendReq('${uid}')">Agregar</button>`;
  return `<div class="user-card">
    <div class="${u.verified?"avatar-ring":""}"><div class="avatar sm">${esc(avatarInitial(name))}</div></div>
    <div class="uc-info" onclick="openUserModal('${uid}')"><span class="uc-name">${esc(name)}${vBadge(u)}</span><span class="uc-meta">${esc(u.email||"")}</span></div>
    <div class="uc-actions">${actions}</div>
  </div>`;
}
function renderFriends(){
  const list=Object.keys(friends).map(uid=>[uid,usersCache[uid]||{name:"Usuario"}]);
  $("friendsList").innerHTML=list.length?list.map(([uid,u])=>userCard(uid,u)).join(""):'<p class="empty">Aún no tienes amigos.</p>';
}

// ===== Historias (texto, expiran 24h) =====
function setupStories(){
  $("storyAdd").addEventListener("click",()=>{
    const text=prompt("Escribe tu historia (texto, dura 24h):");
    if(!text||!text.trim())return;
    set(push(ref(db,"stories")),{uid:me.uid,name:myProfile.name,text:text.trim(),timestamp:Date.now()});
    toast("Historia publicada ✅");
  });
  onValue(ref(db,"stories"),snap=>{
    const now=Date.now();
    const stories=Object.entries(snap.val()||{}).map(([id,s])=>({id,...s})).filter(s=>now-(s.timestamp||0)<86400000);
    const byFriend=stories.filter(s=>friends[s.uid]||s.uid===me.uid);
    const bar=$("stories");
    const existing=$("storyAdd");
    bar.innerHTML="";bar.appendChild(existing);
    byFriend.forEach(s=>{
      const el=document.createElement("div");
      el.className="story";
      el.innerHTML=`<div class="avatar-ring"><div class="avatar sm">${esc(avatarInitial(s.name))}</div></div><span>${esc((s.name||"").split(" ")[0])}</span>`;
      el.addEventListener("click",()=>openStory(s));
      bar.appendChild(el);
    });
  });
}
window.openStory=s=>{
  $("storyAvatar").textContent=avatarInitial(s.name);
  $("storyAuthor").innerHTML=esc(s.name)+vBadge(usersCache[s.uid]);
  $("storyContent").textContent=s.text;
  $("storyTime").textContent=timeAgo(s.timestamp);
  $("storyModal").classList.remove("hidden");
  clearTimeout(window._storyT);
  window._storyT=setTimeout(closeStory,5000);
};
window.closeStory=()=>{$("storyModal").classList.add("hidden");clearTimeout(window._storyT);};

// ===== Feed =====
function setupFeed(){
  onValue(ref(db,"posts"),snap=>{
    const posts=Object.entries(snap.val()||{}).map(([id,p])=>({id,...p}))
      .filter(p=>!blocked[p.uid]).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,50);
    renderPosts($("feedList"),posts);
  });
}
function renderPosts(container,posts){
  if(!posts.length){container.innerHTML='<p class="empty">No hay publicaciones. ¡Sé el primero!</p>';return;}
  container.innerHTML=posts.map(p=>postHTML(p)).join("");
}
function postHTML(p){
  const likes=p.likes||{};const liked=!!likes[me.uid];const likeCount=Object.keys(likes).length;
  const comments=Object.entries(p.comments||{}).map(([id,c])=>({id,...c}));
  const mine=p.uid===me.uid;
  const author=usersCache[p.uid]||{name:p.name};
  const saved=p.saved&&p.saved[me.uid];
  return `<article class="post" data-id="${p.id}">
    <div class="post-head">
      <div class="${author.verified?"avatar-ring":""}"><div class="avatar sm">${esc(avatarInitial(p.name||"?"))}</div></div>
      <div><span class="post-author" onclick="openUserModal('${p.uid}')">${esc(p.name||"Usuario")}${vBadge(author)}</span><span class="post-time">${p.timestamp?formatDate(p.timestamp):""}</span></div>
    </div>
    <div class="post-text">${esc(p.text)}</div>
    <div class="post-actions">
      <button class="action-btn ${liked?"liked":""}" onclick="toggleLike('${p.id}')">${liked?"❤️":"🤍"} <span>${likeCount}</span></button>
      <button class="action-btn" onclick="toggleComments('${p.id}')">💬 <span>${comments.length}</span></button>
      <button class="action-btn ${saved?"saved":""}" onclick="toggleSave('${p.id}')">🔖</button>
      <button class="action-btn" onclick="openReport('post','${p.id}')">⚠️</button>
      ${mine?`<button class="delete-post" onclick="deletePost('${p.id}')">🗑 Eliminar</button>`:""}
    </div>
    <div class="comments-section hidden" id="comments-${p.id}">
      ${comments.map(c=>`<div class="comment"><div class="avatar">${esc(avatarInitial(c.name))}</div><div><b>${esc(c.name)}</b>${esc(c.text)}</div></div>`).join("")}
      <div class="comment-input-row"><input type="text" placeholder="Escribe un comentario…" id="cinput-${p.id}" onkeydown="if(event.key==='Enter')addComment('${p.id}')"><button onclick="addComment('${p.id}')">Enviar</button></div>
    </div>
  </article>`;
}
window.toggleLike=async postId=>{
  const r=ref(db,`posts/${postId}/likes/${me.uid}`);
  const s=await get(r);
  if(s.exists()){await remove(r);}
  else{
    await set(r,true);
    const p=await get(ref(db,"posts/"+postId));
    if(p.exists()&&p.val().uid!==me.uid)await pushNotif(p.val().uid,`${myProfile.name} le dio me gusta a tu publicación`,"❤️");
  }
};
window.toggleComments=postId=>$("comments-"+postId).classList.toggle("hidden");
window.addComment=async postId=>{
  const inp=$("cinput-"+postId);const text=inp.value.trim();if(!text)return;
  const myName=myProfile.name||me.email.split("@")[0];
  await set(push(ref(db,`posts/${postId}/comments`)),{uid:me.uid,name:myName,text,timestamp:Date.now()});
  const p=await get(ref(db,"posts/"+postId));
  if(p.exists()&&p.val().uid!==me.uid)await pushNotif(p.val().uid,`${myName} comentó tu publicación: "${text.slice(0,30)}"`,"💬");
  inp.value="";
};
window.toggleSave=async postId=>{
  const r=ref(db,`posts/${postId}/saved/${me.uid}`);
  const s=await get(r);
  if(s.exists()){await remove(r);toast("Quitado de guardados");}else{await set(r,true);toast("Guardado 🔖");}
};
window.deletePost=async postId=>{if(!confirm("¿Eliminar esta publicación?"))return;await remove(ref(db,"posts/"+postId));toast("Publicación eliminada");};

function setupPostComposer(){
  const ta=$("postInput");
  ta.addEventListener("input",()=>$("postCount").textContent=ta.value.length+"/500");
  $("postBtn").addEventListener("click",async()=>{
    const text=ta.value.trim();if(!text)return;
    const myName=myProfile.name||me.email.split("@")[0];
    await set(push(ref(db,"posts")),{uid:me.uid,name:myName,text,timestamp:serverTimestamp()});
    ta.value="";$("postCount").textContent="0/500";toast("Publicado ✅");
  });
}

// ===== Guardados =====
function setupSaved(){}
function renderSaved(){
  onValue(ref(db,"posts"),snap=>{
    const saved=Object.entries(snap.val()||{}).map(([id,p])=>({id,...p})).filter(p=>p.saved&&p.saved[me.uid]);
    renderPosts($("savedList"),saved);
  });
}

// ===== Notificaciones =====
async function pushNotif(toUid,text,ico){
  await set(push(ref(db,"notifications/"+toUid)),{from:me.uid,text,icon:ico||"🔔",timestamp:Date.now(),read:false});
}
function setupNotifications(){
  onValue(ref(db,"notifications/"+me.uid),snap=>{
    const list=Object.entries(snap.val()||{}).map(([id,n])=>({id,...n})).sort((a,b)=>b.timestamp-a.timestamp);
    const unread=list.filter(n=>!n.read).length;
    const b=$("notifBadge");
    if(unread>0){b.textContent=unread;b.classList.remove("hidden");}else b.classList.add("hidden");
    if($("view-notifications").classList.contains("active"))renderNotifications();
  });
}
function renderNotifications(){
  get(ref(db,"notifications/"+me.uid)).then(snap=>{
    const list=Object.entries(snap.val()||{}).map(([id,n])=>({id,...n})).sort((a,b)=>b.timestamp-a.timestamp).slice(0,30);
    $("notifList").innerHTML=list.length?list.map(n=>`<div class="notif-item ${n.read?"":"unread"}">
      <span class="notif-ico">${n.icon||"🔔"}</span>
      <span class="notif-text">${esc(n.text)}</span>
      <span class="notif-time">${timeAgo(n.timestamp)}</span>
    </div>`).join(""):'<p class="empty">Sin notificaciones</p>';
  });
}
async function markNotifRead(){
  const snap=await get(ref(db,"notifications/"+me.uid));
  const upd={};
  snap.forEach(n=>{if(!n.val().read)upd[`notifications/${me.uid}/${n.key}/read`]=true;});
  if(Object.keys(upd).length)await update(ref(db),upd);
}
$("clearNotif")?.addEventListener("click",async()=>{await remove(ref(db,"notifications/"+me.uid));toast("Notificaciones limpiadas");});

// ===== Chat privado =====
function setupChatUI(){
  $("newChatBtn").addEventListener("click",()=>{
    const list=Object.keys(friends).filter(uid=>!blocked[uid]);
    $("modalFriendList").innerHTML=list.length?list.map(uid=>{
      const u=usersCache[uid]||{name:"Usuario"};
      return `<div class="dm-item" onclick="openChat('${uid}');closeModal()">
        <div class="avatar sm">${esc(avatarInitial(u.name))}</div>
        <div class="dm-info"><span class="dm-name">${esc(u.name)}${vBadge(u)}</span></div></div>`;
    }).join(""):'<p class="empty">Agrega amigos primero</p>';
    $("friendModal").classList.remove("hidden");
  });
  $("closeModal").addEventListener("click",closeModal);
  $("friendModal").addEventListener("click",e=>{if(e.target.id==="friendModal")closeModal();});
  $("convBack").addEventListener("click",()=>{$("chatConvPanel").classList.remove("open");closeConversation();});
  $("convUserClick").addEventListener("click",()=>{if(activeConv)openUserModal(activeConv);});
  $("blockBtn").addEventListener("click",()=>{if(!activeConv)return;if(confirm("¿Bloquear a este usuario? No verás sus mensajes ni publicaciones.")){set(ref(db,`blocked/${me.uid}/${activeConv}`),true);toast("Usuario bloqueado");$("chatConvPanel").classList.remove("open");closeConversation();}});
  $("chatSearch").addEventListener("input",e=>{
    const q=e.target.value.toLowerCase();
    document.querySelectorAll("#dmList .dm-item").forEach(el=>{
      el.style.display=el.textContent.toLowerCase().includes(q)?"":"none";
    });
  });
  $("dmComposer").addEventListener("submit",async e=>{
    e.preventDefault();
    const text=$("dmInput").value.trim();if(!text||!activeConv)return;
    const myName=myProfile.name||me.email.split("@")[0];
    await set(push(ref(db,"messages/private/"+activeConvId)),{fromUid:me.uid,toUid:activeConv,name:myName,text,timestamp:serverTimestamp(),read:false});
    $("dmInput").value="";removeTyping();
  });
  // Typing: solo se activa mientras escribe, con onDisconnect para limpiar
  let typingRef=null,typingTimer=null;
  $("dmInput").addEventListener("input",()=>{
    if(!activeConvId)return;
    if(!$("dmInput").value.trim()){clearTimeout(typingTimer);removeTypingNode();return;}
    if(!typingRef){
      typingRef=ref(db,`typing/private/${activeConvId}/${me.uid}`);
      set(typingRef,{name:myProfile.name||me.email.split("@")[0],ts:Date.now()});
      onDisconnect(typingRef).remove(); // ← corrección: limpia si se desconecta
    }
    clearTimeout(typingTimer);
    typingTimer=setTimeout(()=>{removeTypingNode();typingRef=null;},2000);
  });
  $("dmInput").addEventListener("blur",()=>{clearTimeout(typingTimer);removeTypingNode();typingRef=null;});
  window.removeTypingNode=()=>{if(typingRef){remove(typingRef).catch(()=>{});typingRef=null;}};
}
window.closeModal=()=>$("friendModal").classList.add("hidden");
function removeTyping(){window.removeTypingNode&&window.removeTypingNode();}

async function renderDmList(){
  const fids=Object.keys(friends).filter(uid=>!blocked[uid]);
  if(!fids.length){$("dmList").innerHTML='<p class="empty">Agrega amigos para chatear</p>';return;}
  const items=await Promise.all(fids.map(async uid=>{
    const cid=convId(me.uid,uid);
    const s=await get(query(ref(db,"messages/private/"+cid),orderByChild("timestamp"),limitToLast(1)));
    let last="",unread=0,lastTime=0;
    s.forEach(m=>{const v=m.val();last=v.text;lastTime=v.timestamp||0;});
    const all=await get(ref(db,"messages/private/"+cid));
    all.forEach(m=>{const v=m.val();if(v.toUid===me.uid&&!v.read)unread++;});
    return {uid,last,unread,lastTime};
  }));
  items.sort((a,b)=>b.lastTime-a.lastTime);
  const totalUnread=items.reduce((s,i)=>s+i.unread,0);
  const cb=$("chatBadge");
  if(totalUnread>0){cb.textContent=totalUnread;cb.classList.remove("hidden");}else cb.classList.add("hidden");
  $("dmList").innerHTML=items.map(it=>{
    const u=usersCache[it.uid]||{name:"Usuario"};
    return `<div class="dm-item ${activeConv===it.uid?"active":""}" onclick="openConversation('${it.uid}')">
      <div class="${u.verified?"avatar-ring":""}"><div class="avatar sm">${esc(avatarInitial(u.name))}</div></div>
      <div class="dm-info"><span class="dm-name">${esc(u.name)}${vBadge(u)}</span><span class="dm-last">${esc(it.last||"Sin mensajes")}</span></div>
      ${it.unread?`<span class="dm-unread">${it.unread}</span>`:""}
    </div>`;
  }).join("");
}

window.openConversation=async uid=>{
  if(unsubDm)unsubDm();if(unsubTyping)unsubTyping();
  removeTyping();
  activeConv=uid;activeConvId=convId(me.uid,uid);loadedMsgIds=new Set();
  const u=usersCache[uid]||{name:"Usuario"};
  $("convName").innerHTML=esc(u.name)+vBadge(u);
  $("convAvatar").textContent=avatarInitial(u.name);
  updateConvStatus();
  $("convPlaceholder").classList.add("hidden");
  $("convActive").classList.remove("hidden");
  $("chatConvPanel").classList.add("open");
  $("dmMessages").innerHTML="";
  // Marcar leídos
  const all=await get(ref(db,"messages/private/"+activeConvId));
  const upd={};
  all.forEach(m=>{const v=m.val();if(v.toUid===me.uid&&!v.read)upd[`messages/private/${activeConvId}/${m.key}/read`]=true;});
  if(Object.keys(upd).length)await update(ref(db),upd);
  // Limpiar typing huérfano al abrir
  const typSnap=await get(ref(db,"typing/private/"+activeConvId));
  if(typSnap.exists()){typSnap.forEach(t=>{if(Date.now()-(t.val().ts||0)>5000)remove(ref(`typing/private/${activeConvId}/${t.key}`)).catch(()=>{});});}
  // Escuchar mensajes
  unsubDm=onChildAdded(query(ref(db,"messages/private/"+activeConvId),orderByChild("timestamp"),limitToLast(100)),snap=>{
    if(loadedMsgIds.has(snap.key))return;
    loadedMsgIds.add(snap.key);
    renderDmMessage(snap.key,snap.val());
    $("dmMessages").scrollTop=$("dmMessages").scrollHeight;
    const v=snap.val();
    if(v.toUid===me.uid&&!v.read)update(ref(db,`messages/private/${activeConvId}/${snap.key}`),{read:true});
  });
  // Typing: SOLO muestra si el OTRO usuario tiene nodo activo (corregido)
  unsubTyping=onValue(ref(db,"typing/private/"+activeConvId),snap=>{
    const data=snap.val()||{};
    const other=Object.entries(data).find(([id,v])=>id!==me.uid&&v&&v.name&&(Date.now()-(v.ts||0)<5000));
    if(other){$("dmTypingName").textContent=other[1].name+" está escribiendo…";$("dmTyping").hidden=false;}
    else $("dmTyping").hidden=true;
  });
  renderDmList();
};
function closeConversation(){
  removeTyping();
  if(unsubDm){unsubDm();unsubDm=null;}
  if(unsubTyping){unsubTyping();unsubTyping=null;}
  activeConv=null;activeConvId=null;
  $("convActive").classList.add("hidden");$("convPlaceholder").classList.remove("hidden");
}
function updateConvStatus(){
  if(!activeConv)return;
  const el=$("convStatus");
  if(onlineUsers[activeConv]){el.textContent="En línea";el.classList.remove("off");}
  else{el.textContent="Desconectado";el.classList.add("off");}
}
function renderDmMessage(id,msg){
  const isMe=msg.fromUid===me.uid;
  const row=document.createElement("div");
  row.className="msg-row"+(isMe?" me":"");
  row.innerHTML=`<div class="avatar msg-avatar">${esc(avatarInitial(msg.name))}</div>
    <div class="bubble"><span>${esc(msg.text)}</span><span class="msg-time">${msg.timestamp?formatTime(msg.timestamp):""}</span>
    ${isMe?`<span class="read-receipt">${msg.read?"✓✓":"✓"}</span>`:""}</div>
    ${isMe?`<div class="msg-actions"><button onclick="deleteMsg('${id}')">🗑</button></div>`:""}`;
  $("dmMessages").appendChild(row);
}
window.deleteMsg=async id=>{if(confirm("¿Eliminar mensaje?"))await remove(ref(db,`messages/private/${activeConvId}/${id}`));toast("Mensaje eliminado");location.reload();};
function setupBlock(){}

// ===== Perfil de otro usuario (modal) =====
window.openUserModal=async uid=>{
  const u=usersCache[uid]||{};
  const name=u.name||"Usuario";
  const isFriend=friends[uid];
  const posts=Object.entries((await get(ref(db,"posts"))).val()||{}).map(([id,p])=>({id,...p})).filter(p=>p.uid===uid).slice(0,5);
  const friendCount=Object.keys((await get(ref(db,"friends/"+uid))).val()||{}).length;
  let actions;
  if(isFriend)actions=`<button class="btn-ghost" onclick="openChat('${uid}');closeUserModal()">💬 Mensaje</button>`;
  else actions=`<button class="btn-ghost" onclick="sendReq('${uid}')">🤝 Agregar amigo</button>`;
  actions+=`<button class="btn-danger-ghost" onclick="openReport('user','${uid}')">⚠️ Reportar</button>`;
  $("userModalBody").innerHTML=`
    <div class="ump-head">
      <div class="avatar big" style="margin:0 auto 10px">${esc(avatarInitial(name))}</div>
      <h3 style="display:inline-flex;align-items:center">${esc(name)}${vBadge(u)}</h3>
      <p style="color:var(--soft);font-size:13px;margin-top:4px">${esc(u.email||"")}</p>
      <p style="margin-top:8px;font-size:14px">${esc(u.bio||"Sin biografía")}</p>
    </div>
    <div class="ump-stats"><div><b>${posts.length}</b><span>Posts</span></div><div><b>${friendCount}</b><span>Amigos</span></div><div><b>${u.createdAt?new Date(u.createdAt).toLocaleDateString():"—"}</b><span>Desde</span></div></div>
    <div class="ump-actions">${actions}</div>
    <div class="ump-posts"><h4 style="margin-bottom:10px;font-size:13px;color:var(--soft)">Publicaciones recientes</h4>
      ${posts.length?posts.map(p=>`<div class="post" style="margin-bottom:10px"><div class="post-text" style="padding:12px 14px;font-size:13.5px">${esc(p.text)}</div></div>`).join(""):'<p class="empty">Sin publicaciones</p>'}
    </div>`;
  $("userModal").classList.remove("hidden");
};
window.closeUserModal=()=>$("userModal").classList.add("hidden");

// ===== Reportes =====
window.openReport=(type,id)=>{reportType=type;reportTarget=id;$("reportModal").classList.remove("hidden");};
window.closeReport=()=>$("reportModal").classList.add("hidden");
$("sendReport").addEventListener("click",async()=>{
  const reason=$("reportReason").value;
  const details=$("reportDetails").value.trim();
  await set(push(ref(db,"reports")),{type:reportType,targetId:reportTarget,reason,details,reportedBy:me.uid,timestamp:Date.now(),status:"pending"});
  closeReport();$("reportDetails").value="";
  toast("Reporte enviado al administrador ✅");
});

// ===== Anuncio global =====
function setupAnnouncement(){
  onValue(ref(db,"settings/announcement"),snap=>{
    if(snap.exists()&&snap.val()){$("annText").textContent="📢 "+snap.val();$("announcement").classList.remove("hidden");}
    else $("announcement").classList.add("hidden");
  });
}

// ===== Emoji picker =====
function setupEmojiPicker(){
  const picker=$("emojiPicker");
  picker.innerHTML=EMOJIS.map(e=>`<button type="button">${e}</button>`).join("");
  picker.addEventListener("click",e=>{
    if(e.target.tagName!=="BUTTON")return;
    if(emojiTarget){const inp=$(emojiTarget);inp.value+=e.target.textContent;inp.focus();}
    picker.classList.add("hidden");
  });
  document.querySelectorAll(".emoji-trigger").forEach(btn=>btn.addEventListener("click",e=>{
    e.stopPropagation();
    emojiTarget=btn.dataset.target;
    picker.classList.toggle("hidden");
    const r=btn.getBoundingClientRect();
    picker.style.bottom=(window.innerHeight-r.top+10)+"px";
    picker.style.left=Math.min(r.left,window.innerWidth-340)+"px";
  }));
  document.addEventListener("click",e=>{if(!e.target.closest(".emoji-picker")&&!e.target.closest(".emoji-trigger"))picker.classList.add("hidden");});
}

// ===== Perfil propio =====
function renderProfile(){
  const name=myProfile.name||me.email.split("@")[0];
  $("profileName").innerHTML=esc(name)+vBadge(myProfile);
  $("profileEmail").textContent=me.email;
  $("profileBio").textContent=myProfile.bio||"Sin biografía";
  $("profileAvatar").textContent=avatarInitial(name);
  $("editName").value=name;
  $("editBio").value=myProfile.bio||"";
  $("statSince").textContent=myProfile.createdAt?new Date(myProfile.createdAt).toLocaleDateString():"—";
}
function setupProfileEdit(){
  $("saveProfileBtn").addEventListener("click",async()=>{
    const name=$("editName").value.trim()||me.email.split("@")[0];
    const bio=$("editBio").value.trim();
    await update(ref(db,"users/"+me.uid),{name,bio});
    await updateProfile(me,{displayName:name}).catch(()=>{});
    myProfile.name=name;myProfile.bio=bio;
    $("sideName").innerHTML=esc(name)+vBadge(myProfile);
    $("sideAvatar").textContent=avatarInitial(name);
    $("feedAvatar").textContent=avatarInitial(name);
    renderProfile();
    $("saveOk").classList.remove("hidden");
    setTimeout(()=>$("saveOk").classList.add("hidden"),2000);
    toast("Perfil actualizado ✅");
  });
}
function loadMyPosts(){
  onValue(ref(db,"posts"),snap=>{
    const mine=Object.entries(snap.val()||{}).map(([id,p])=>({id,...p})).filter(p=>p.uid===me.uid).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
    $("statPosts").textContent=mine.length;
    renderPosts($("myPosts"),mine);
  });
}

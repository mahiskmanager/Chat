// Inside v4.0 — App completa expandida (WhatsApp/Telegram/Facebook style)
import { auth, db, avatarInitial, formatTime, formatDate, timeAgo, verifiedBadge, EMOJIS, applyTheme, toggleTheme } from "./firebase-config.js";
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { ref, set, push, update, remove, onValue, get, serverTimestamp, query, orderByChild, limitToLast, onDisconnect } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";

let me=null, myProfile=null, friends={}, usersCache={}, onlineUsers={}, blocked={};
let activeConv=null, activeConvId=null, isGroup=false, unsubDm=null, unsubTyping=null;
let emojiTarget=null, reportTarget=null, reportType=null, currentStory=null;
let typingRef=null, typingTimer=null, replyTo=null, activeHashtag=null;
let settings={sound:true}, bannedWords=[], searchTab="users", groupsCache={};

const $=id=>document.getElementById(id);
const esc=s=>{const d=document.createElement("div");d.textContent=s??"";return d.innerHTML;};
const convId=(a,b)=>[a,b].sort().join("_");
const vBadge=u=>u&&u.verified?verifiedBadge(14):"";
const toast=msg=>{const t=$("toast");t.textContent=msg;t.classList.remove("hidden");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.add("hidden"),2500);};
const REACTIONS=["❤️","👍","😂","😮","😢"];

applyTheme();

onAuthStateChanged(auth,async user=>{
  if(!user){location.replace("index.html");return;}
  me=user;
  const u=await get(ref(db,"users/"+me.uid));
  if(u.exists()&&u.val().banned){await signOut(auth);location.replace("index.html");return;}
  init();
});
$("logoutBtn").addEventListener("click",async()=>{removeTypingNode();await signOut(auth);});
$("themeBtn").addEventListener("click",()=>{toggleTheme();$("themeBtn").textContent=document.body.classList.contains("dark")?"☀️":"🌙";});

async function init(){
  await loadMyProfile();
  setupPresence();setupNav();setupOnlineCounter();setupFriends();setupRequestsBadge();
  setupFeed();setupPostComposer();setupSearch();setupProfileEdit();setupChatUI();
  setupStories();setupNotifications();setupAnnouncement();setupEmojiPicker();setupGroups();
  setupSettings();loadAdminSettings();
  renderProfile();loadMyPosts();renderBlockedList();
  $("themeBtn").textContent=document.body.classList.contains("dark")?"☀️":"🌙";
  if("Notification" in window&&Notification.permission==="granted")$("enableNotifBtn").textContent="✅ Activadas";
}

function loadAdminSettings(){
  onValue(ref(db,"settings/maintenance"),s=>{
    if(s.exists()&&s.val()){$("maintenance").classList.remove("hidden");get(ref(db,"settings/maintenanceText")).then(t=>{if(t.exists())$("maintenanceText").textContent=t.val();});}
    else $("maintenance").classList.add("hidden");
  });
  onValue(ref(db,"settings/bannedWords"),s=>{bannedWords=(s.val()||"").split(",").map(w=>w.trim().toLowerCase()).filter(Boolean);});
  onValue(ref(db,"settings/accentColor"),s=>{if(s.exists()&&s.val())document.documentElement.style.setProperty("--primary",s.val());});
}
function hasBannedWords(text){const low=text.toLowerCase();return bannedWords.some(w=>w&&low.includes(w));}

async function loadMyProfile(){
  const snap=await get(ref(db,"users/"+me.uid));
  myProfile=snap.val()||{};
  const name=myProfile.name||me.displayName||me.email.split("@")[0];
  $("sideName").innerHTML=esc(name)+vBadge(myProfile);
  $("sideEmail").textContent=me.email;
  $("sideAvatar").textContent=avatarInitial(name);
  $("feedAvatar").textContent=avatarInitial(name);
  if(!snap.exists())await set(ref(db,"users/"+me.uid),{name,bio:"",email:me.email,createdAt:Date.now(),verified:false,banned:false,status:"Disponible"});
}
function setupPresence(){
  const name=myProfile.name||me.email.split("@")[0];
  const myRef=ref(db,"presence/"+me.uid);
  set(myRef,{name,online:true});
  onDisconnect(myRef).remove();
  onDisconnect(ref(db,"users/"+me.uid+"/lastSeen")).set(Date.now());
}
function setupOnlineCounter(){
  onValue(ref(db,"presence"),snap=>{onlineUsers=snap.val()||{};const n=Object.keys(onlineUsers).length;$("topOnline").textContent=n+(n===1?" en línea":" en línea");if(activeConv&&!isGroup)updateConvStatus();});
}
function setupNav(){
  const titles={feed:"Inicio",chats:"Mensajes",groups:"Grupos",people:"Explorar",requests:"Solicitudes",notifications:"Notificaciones",saved:"Guardados",profile:"Mi Perfil",settings:"Ajustes"};
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
    if(btn.dataset.view==="groups")renderGroups();
    if(btn.dataset.view==="settings")renderBlockedList();
    if(btn.dataset.view==="chats"&&!activeConv){const fids=Object.keys(friends).filter(uid=>!blocked[uid]);if(fids.length)openConversation(fids[0]);}
  }));
  $("menuToggle").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
  document.querySelectorAll(".stab").forEach(b=>b.addEventListener("click",()=>{
    document.querySelectorAll(".stab").forEach(x=>x.classList.remove("active"));b.classList.add("active");searchTab=b.dataset.stab;doSearch();
  }));
}
function setupFriends(){
  onValue(ref(db,"friends/"+me.uid),snap=>{friends=snap.val()||{};renderFriends();renderDmList();renderSuggestions();$("statFriends").textContent=Object.keys(friends).length;});
  onValue(ref(db,"blocked/"+me.uid),snap=>{blocked=snap.val()||{};});
  onValue(ref(db,"users"),snap=>{
    usersCache=snap.val()||{};
    renderFriends();renderDmList();renderSuggestions();
    if(activeConv&&!isGroup){const u=usersCache[activeConv];if(u){$("convName").innerHTML=esc(u.name)+vBadge(u);$("convAvatar").textContent=avatarInitial(u.name);}}
  });
}

async function sendFriendRequest(uid){
  const myName=myProfile.name||me.email.split("@")[0];
  await set(ref(db,`friendRequests/incoming/${uid}/${me.uid}`),{fromUid:me.uid,name:myName,timestamp:Date.now()});
  await set(ref(db,`friendRequests/sent/${me.uid}/${uid}`),{toUid:uid,name:usersCache[uid]?.name||"Usuario",timestamp:Date.now()});
  await pushNotif(uid,`${myName} te envió una solicitud de amistad`,"🤝");
  toast("Solicitud enviada");renderFriends();renderSuggestions();
}
async function cancelFriendRequest(uid){await remove(ref(db,`friendRequests/incoming/${uid}/${me.uid}`)).catch(()=>{});await remove(ref(db,`friendRequests/sent/${me.uid}/${uid}`)).catch(()=>{});toast("Solicitud cancelada");renderFriends();renderSuggestions();}
async function acceptFriendRequest(uid){
  const upd={};upd[`friends/${me.uid}/${uid}`]=true;upd[`friends/${uid}/${me.uid}`]=true;upd[`friendRequests/incoming/${me.uid}/${uid}`]=null;upd[`friendRequests/sent/${uid}/${me.uid}`]=null;
  await update(ref(db),upd);await pushNotif(uid,`${myProfile.name} aceptó tu solicitud`,"✅");toast("¡Ahora son amigos!");renderRequests();renderFriends();renderSuggestions();
}
async function declineFriendRequest(uid){const upd={};upd[`friendRequests/incoming/${me.uid}/${uid}`]=null;upd[`friendRequests/sent/${uid}/${me.uid}`]=null;await update(ref(db),upd);toast("Solicitud rechazada");renderRequests();}
window.acceptReq=acceptFriendRequest;window.declineReq=declineFriendRequest;window.cancelReq=cancelFriendRequest;window.sendReq=sendFriendRequest;
window.openChat=uid=>{document.querySelector('[data-view="chats"]').click();openConversation(uid);};

function setupRequestsBadge(){onValue(ref(db,"friendRequests/incoming/"+me.uid),snap=>{const n=snap.numChildren();const b=$("reqBadge");if(n>0){b.textContent=n;b.classList.remove("hidden");}else b.classList.add("hidden");});}
function renderRequests(){
  get(ref(db,"friendRequests/incoming/"+me.uid)).then(snap=>{
    const list=Object.values(snap.val()||{});
    $("incomingList").innerHTML=list.length?list.map(r=>`<div class="user-card"><div class="avatar sm">${esc(avatarInitial(r.name))}</div><div class="uc-info" onclick="openUserModal('${r.fromUid}')"><span class="uc-name">${esc(r.name)}</span><span class="uc-meta">Quiere ser tu amigo</span></div><div class="uc-actions"><button class="btn-ghost" onclick="acceptReq('${r.fromUid}')">Aceptar</button><button class="btn-danger-ghost" onclick="declineReq('${r.fromUid}')">✕</button></div></div>`).join(""):'<p class="empty">No tienes solicitudes pendientes</p>';
  });
  get(ref(db,"friendRequests/sent/"+me.uid)).then(snap=>{
    const list=Object.values(snap.val()||{});
    $("sentList").innerHTML=list.length?list.map(r=>`<div class="user-card"><div class="avatar sm">${esc(avatarInitial(r.name))}</div><div class="uc-info" onclick="openUserModal('${r.toUid}')"><span class="uc-name">${esc(r.name)}</span><span class="uc-meta">Pendiente</span></div><div class="uc-actions"><button class="btn-danger-ghost" onclick="cancelReq('${r.toUid}')">Cancelar</button></div></div>`).join(""):'<p class="empty">No has enviado solicitudes</p>';
  });
}

function setupSearch(){$("searchInput").addEventListener("input",doSearch);}
function doSearch(){
  const q=$("searchInput").value.trim().toLowerCase();
  const box=$("searchResults");
  if(!q){box.innerHTML="";renderSuggestions();return;}
  if(searchTab==="users"){
    const results=Object.entries(usersCache).filter(([uid])=>uid!==me.uid&&!blocked[uid]).filter(([,u])=>(u.name||"").toLowerCase().includes(q)||(u.email||"").toLowerCase().includes(q)).slice(0,20);
    box.innerHTML=`<h3 class="sec-title">Resultados</h3><div class="user-grid">${results.length?results.map(([uid,u])=>userCard(uid,u)).join(""):'<p class="empty">Sin resultados</p>'}</div>`;
  }else if(searchTab==="posts"){
    get(ref(db,"posts")).then(s=>{
      const posts=Object.entries(s.val()||{}).map(([id,p])=>({id,...p})).filter(p=>(p.text||"").toLowerCase().includes(q)).slice(0,20);
      box.innerHTML=`<h3 class="sec-title">Publicaciones</h3><div class="feed-list">${posts.length?posts.map(p=>postHTML(p)).join(""):'<p class="empty">Sin resultados</p>'}</div>`;
    });
  }else{
    get(ref(db,"posts")).then(s=>{
      const tags={};
      Object.values(s.val()||{}).forEach(p=>{(p.text||"").match(/#\w+/g)?.forEach(t=>{const k=t.toLowerCase();tags[k]=(tags[k]||0)+1;});});
      const found=Object.entries(tags).filter(([t])=>t.includes(q)).sort((a,b)=>b[1]-a[1]);
      box.innerHTML=`<h3 class="sec-title">Hashtags</h3><div style="display:flex;flex-wrap:wrap;gap:8px">${found.length?found.map(([t,c])=>`<button class="btn-ghost" onclick="filterByHashtag('${t.slice(1)}')">${esc(t)} <span style="opacity:.6">(${c})</span></button>`).join(""):'<p class="empty">Sin hashtags</p>'}</div>`;
    });
  }
}
function renderSuggestions(){
  const sugg=Object.entries(usersCache).filter(([uid])=>uid!==me.uid&&!friends[uid]&&!blocked[uid]).slice(0,6);
  $("suggestList").innerHTML=sugg.length?sugg.map(([uid,u])=>userCard(uid,u)).join(""):'<p class="empty">No hay sugerencias</p>';
}
function userCard(uid,u){
  const name=u.name||"Usuario";const isFriend=friends[uid];const online=onlineUsers[uid];
  const actions=isFriend?`<span class="status-pill ${online?"online":""}">${online?"En línea":"Amigo"}</span><button class="btn-ghost" onclick="openChat('${uid}')">Mensaje</button>`:`<button class="btn-ghost" onclick="sendReq('${uid}')">Agregar</button>`;
  return `<div class="user-card"><div class="${u.verified?"avatar-ring":""}"><div class="avatar sm">${esc(avatarInitial(name))}</div></div><div class="uc-info" onclick="openUserModal('${uid}')"><span class="uc-name">${esc(name)}${vBadge(u)}</span><span class="uc-meta">${esc(u.email||"")}</span></div><div class="uc-actions">${actions}</div></div>`;
}
function renderFriends(){const list=Object.keys(friends).map(uid=>[uid,usersCache[uid]||{name:"Usuario"}]);$("friendsList").innerHTML=list.length?list.map(([uid,u])=>userCard(uid,u)).join(""):'<p class="empty">Aún no tienes amigos.</p>';}

function setupStories(){
  $("storyAdd").addEventListener("click",()=>{const text=prompt("Escribe tu historia (dura 24h):");if(!text||!text.trim())return;set(push(ref(db,"stories")),{uid:me.uid,name:myProfile.name,text:text.trim(),timestamp:Date.now()});toast("Historia publicada ✅");});
  $("storyDelete").addEventListener("click",()=>{if(!currentStory)return;if(confirm("¿Eliminar esta historia?")){remove(ref(db,"stories/"+currentStory.id));closeStory();toast("Historia eliminada");}});
  onValue(ref(db,"stories"),snap=>{
    const now=Date.now();
    const stories=Object.entries(snap.val()||{}).map(([id,s])=>({id,...s})).filter(s=>now-(s.timestamp||0)<86400000&&(friends[s.uid]||s.uid===me.uid));
    const bar=$("stories");const existing=$("storyAdd");bar.innerHTML="";bar.appendChild(existing);
    stories.forEach(s=>{const el=document.createElement("div");el.className="story";el.innerHTML=`<div class="avatar-ring"><div class="avatar sm">${esc(avatarInitial(s.name))}</div></div><span>${esc((s.name||"").split(" ")[0])}</span>`;el.addEventListener("click",()=>openStory(s));bar.appendChild(el);});
  });
}
window.openStory=s=>{currentStory=s;$("storyAvatar").textContent=avatarInitial(s.name);$("storyAuthor").innerHTML=esc(s.name)+vBadge(usersCache[s.uid]);$("storyContent").textContent=s.text;$("storyTime").textContent=timeAgo(s.timestamp);$("storyDelete").classList.toggle("hidden",s.uid!==me.uid);$("storyModal").classList.remove("hidden");clearTimeout(window._storyT);window._storyT=setTimeout(closeStory,5000);};
window.closeStory=()=>{$("storyModal").classList.add("hidden");clearTimeout(window._storyT);currentStory=null;};

function setupFeed(){
  onValue(ref(db,"posts"),snap=>{
    let posts=Object.entries(snap.val()||{}).map(([id,p])=>({id,...p})).filter(p=>!blocked[p.uid]).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,50);
    if(activeHashtag)posts=posts.filter(p=>(p.text||"").toLowerCase().includes("#"+activeHashtag));
    renderPosts($("feedList"),posts);
  });
}
function renderPosts(container,posts){if(!posts.length){container.innerHTML='<p class="empty">No hay publicaciones.</p>';return;}container.innerHTML=posts.map(p=>postHTML(p)).join("");}
function linkify(text){
  let h=esc(text);
  h=h.replace(/#(\w+)/g,'<span class="hashtag-link" onclick="filterByHashtag(\'$1\')">#$1</span>');
  h=h.replace(/@(\w+)/g,'<span class="mention-link">@$1</span>');
  return h;
}
window.filterByHashtag=tag=>{activeHashtag=tag.toLowerCase();$("hashtagName").textContent="#"+tag;$("hashtagFilter").classList.remove("hidden");document.querySelector('[data-view="feed"]').click();};
window.clearHashtag=()=>{activeHashtag=null;$("hashtagFilter").classList.add("hidden");};
function postHTML(p){
  const likes=p.likes||{};const liked=!!likes[me.uid];const likeCount=Object.keys(likes).length;
  const comments=Object.entries(p.comments||{}).map(([id,c])=>({id,...c}));
  const mine=p.uid===me.uid;const author=usersCache[p.uid]||{name:p.name};const saved=p.saved&&p.saved[me.uid];
  let pollHTML="";
  if(p.poll&&p.poll.options){
    const total=Object.values(p.poll.options).reduce((s,o)=>s+Object.keys(o.votes||{}).length,0);
    const myVote=Object.entries(p.poll.options).find(([,o])=>o.votes&&o.votes[me.uid]);
    pollHTML=`<div class="poll-options">${Object.entries(p.poll.options).map(([oid,o])=>{
      const vc=Object.keys(o.votes||{}).length;const pct=total?Math.round(vc/total*100):0;
      return `<div class="poll-opt-bar ${myVote?"voted":""}" onclick="${myVote?"":`votePoll('${p.id}','${oid}')`}"><div class="poll-fill" style="width:${myVote?pct:0}%"></div><div class="poll-opt-label"><span>${esc(o.text)}</span><span>${myVote?pct+"%":""}</span></div></div>`;
    }).join("")}<p style="font-size:11.5px;color:var(--soft);margin-top:6px">${total} voto${total!==1?"s":""}</p></div>`;
  }
  return `<article class="post" data-id="${p.id}">
    <div class="post-head"><div class="${author.verified?"avatar-ring":""}"><div class="avatar sm">${esc(avatarInitial(p.name||"?"))}</div></div>
    <div><span class="post-author" onclick="openUserModal('${p.uid}')">${esc(p.name||"Usuario")}${vBadge(author)}</span><span class="post-time">${p.timestamp?formatDate(p.timestamp):""}</span></div></div>
    <div class="post-text">${linkify(p.text)}</div>
    ${pollHTML}
    <div class="post-actions">
      <button class="action-btn ${liked?"liked":""}" onclick="toggleLike('${p.id}')">${liked?"❤️":"🤍"} <span>${likeCount}</span></button>
      <button class="action-btn" onclick="toggleComments('${p.id}')">💬 <span>${comments.length}</span></button>
      <button class="action-btn ${saved?"saved":""}" onclick="toggleSave('${p.id}')">🔖</button>
      <button class="action-btn" onclick="sharePost('${p.id}')">↗️</button>
      <button class="action-btn" onclick="openReport('post','${p.id}')">⚠️</button>
      ${mine?`<button class="delete-post" onclick="deletePost('${p.id}')">🗑</button>`:""}
    </div>
    <div class="comments-section hidden" id="comments-${p.id}">
      ${comments.map(c=>`<div class="comment"><div class="avatar">${esc(avatarInitial(c.name))}</div><div><b>${esc(c.name)}</b>${linkify(c.text)}</div></div>`).join("")}
      <div class="comment-input-row"><input type="text" placeholder="Escribe un comentario…" id="cinput-${p.id}" onkeydown="if(event.key==='Enter')addComment('${p.id}')"><button onclick="addComment('${p.id}')">Enviar</button></div>
    </div>
  </article>`;
}
window.votePoll=async(postId,optId)=>{
  const p=await get(ref(db,"posts/"+postId+"/poll/options"));
  const upd={};
  p.forEach(o=>{if(o.val().votes&&o.val().votes[me.uid])upd[`posts/${postId}/poll/options/${o.key}/votes/${me.uid}`]=null;});
  upd[`posts/${postId}/poll/options/${optId}/votes/${me.uid}`]=true;
  await update(ref(db),upd);
};
window.toggleLike=async postId=>{const r=ref(db,`posts/${postId}/likes/${me.uid}`);const s=await get(r);if(s.exists())await remove(r);else{await set(r,true);const p=await get(ref(db,"posts/"+postId));if(p.exists()&&p.val().uid!==me.uid)await pushNotif(p.val().uid,`${myProfile.name} le dio me gusta a tu publicación`,"❤️");}};
window.toggleComments=postId=>$("comments-"+postId).classList.toggle("hidden");
window.addComment=async postId=>{
  const inp=$("cinput-"+postId);const text=inp.value.trim();if(!text)return;
  if(hasBannedWords(text)){toast("⚠️ Palabras no permitidas");return;}
  const myName=myProfile.name||me.email.split("@")[0];
  await set(push(ref(db,`posts/${postId}/comments`)),{uid:me.uid,name:myName,text,timestamp:Date.now()});
  const p=await get(ref(db,"posts/"+postId));
  if(p.exists()&&p.val().uid!==me.uid)await pushNotif(p.val().uid,`${myName} comentó tu publicación`,"💬");
  text.match(/@(\w+)/g)?.forEach(m=>{const uname=m.slice(1).toLowerCase();const target=Object.entries(usersCache).find(([,u])=>(u.name||"").toLowerCase().startsWith(uname));if(target&&target[0]!==me.uid)pushNotif(target[0],`${myName} te mencionó en un comentario`,"@");});
  inp.value="";
};
window.toggleSave=async postId=>{const r=ref(db,`posts/${postId}/saved/${me.uid}`);const s=await get(r);if(s.exists()){await remove(r);toast("Quitado de guardados");}else{await set(r,true);toast("Guardado 🔖");}};
window.deletePost=async postId=>{if(!confirm("¿Eliminar esta publicación?"))return;await remove(ref(db,"posts/"+postId));toast("Publicación eliminada");};
window.sharePost=async postId=>{
  const friendsList=Object.keys(friends);
  if(!friendsList.length){toast("Agrega amigos para compartir");return;}
  const p=await get(ref(db,"posts/"+postId));const text=p.val()?.text||"";
  const myName=myProfile.name||me.email.split("@")[0];
  for(const fid of friendsList.slice(0,5)){const cid=convId(me.uid,fid);await set(push(ref(db,"messages/private/"+cid)),{fromUid:me.uid,toUid:fid,name:myName,text:"📤 Compartió: "+text.slice(0,100),timestamp:serverTimestamp(),read:false});}
  toast("Publicación compartida ✅");
};

function setupPostComposer(){
  const ta=$("postInput");
  ta.addEventListener("input",()=>$("postCount").textContent=ta.value.length+"/500");
  $("pollToggle").addEventListener("click",()=>{$("pollBuilder").classList.toggle("hidden");$("pollToggle").classList.toggle("active");});
  $("postBtn").addEventListener("click",async()=>{
    const text=ta.value.trim();if(!text)return;
    if(hasBannedWords(text)){toast("⚠️ Palabras no permitidas");return;}
    const myName=myProfile.name||me.email.split("@")[0];
    const postData={uid:me.uid,name:myName,text,timestamp:serverTimestamp()};
    if(!$("pollBuilder").classList.contains("hidden")){
      const opts=[...document.querySelectorAll(".poll-opt")].map(i=>i.value.trim()).filter(Boolean);
      if(opts.length>=2){const poll={options:{}};opts.forEach((o,i)=>{poll.options["opt"+i]={text:o,votes:{}};});postData.poll=poll;}
    }
    await set(push(ref(db,"posts")),postData);
    text.match(/@(\w+)/g)?.forEach(m=>{const uname=m.slice(1).toLowerCase();const target=Object.entries(usersCache).find(([,u])=>(u.name||"").toLowerCase().startsWith(uname));if(target&&target[0]!==me.uid)pushNotif(target[0],`${myName} te mencionó en una publicación`,"@");});
    ta.value="";$("postCount").textContent="0/500";$("pollBuilder").classList.add("hidden");document.querySelectorAll(".poll-opt").forEach(i=>i.value="");toast("Publicado ✅");
  });
}

function renderSaved(){onValue(ref(db,"posts"),snap=>{const saved=Object.entries(snap.val()||{}).map(([id,p])=>({id,...p})).filter(p=>p.saved&&p.saved[me.uid]);renderPosts($("savedList"),saved);});}

async function pushNotif(toUid,text,ico){await set(push(ref(db,"notifications/"+toUid)),{from:me.uid,text,icon:ico||"🔔",timestamp:Date.now(),read:false});}
function setupNotifications(){
  onValue(ref(db,"notifications/"+me.uid),snap=>{
    const list=Object.entries(snap.val()||{}).map(([id,n])=>({id,...n})).sort((a,b)=>b.timestamp-a.timestamp);
    const unread=list.filter(n=>!n.read).length;const b=$("notifBadge");
    if(unread>0){b.textContent=unread;b.classList.remove("hidden");}else b.classList.add("hidden");
    if($("view-notifications").classList.contains("active"))renderNotifications();
  });
}
function renderNotifications(){
  get(ref(db,"notifications/"+me.uid)).then(snap=>{
    const list=Object.entries(snap.val()||{}).map(([id,n])=>({id,...n})).sort((a,b)=>b.timestamp-a.timestamp).slice(0,30);
    $("notifList").innerHTML=list.length?list.map(n=>`<div class="notif-item ${n.read?"":"unread"}"><span class="notif-ico">${n.icon||"🔔"}</span><span class="notif-text">${esc(n.text)}</span><span class="notif-time">${timeAgo(n.timestamp)}</span></div>`).join(""):'<p class="empty">Sin notificaciones</p>';
  });
}
async function markNotifRead(){const snap=await get(ref(db,"notifications/"+me.uid));const upd={};snap.forEach(n=>{if(!n.val().read)upd[`notifications/${me.uid}/${n.key}/read`]=true;});if(Object.keys(upd).length)await update(ref(db),upd);}
$("clearNotif")?.addEventListener("click",async()=>{await remove(ref(db,"notifications/"+me.uid));toast("Notificaciones limpiadas");});

function setupGroups(){
  $("createGroupBtn").addEventListener("click",()=>{
    const list=Object.keys(friends);
    $("groupMembers").innerHTML=list.length?list.map(uid=>{const u=usersCache[uid]||{name:"Usuario"};return `<label class="check-row"><input type="checkbox" value="${uid}"><span>${esc(u.name)}</span></label>`;}).join(""):'<p class="empty">Agrega amigos primero</p>';
    $("groupModal").classList.remove("hidden");
  });
  $("createGroupConfirm").addEventListener("click",async()=>{
    const name=$("groupName").value.trim();if(!name){toast("Escribe un nombre para el grupo");return;}
    const members=[...document.querySelectorAll("#groupMembers input:checked")].map(i=>i.value);
    if(!members.length){toast("Selecciona al menos un miembro");return;}
    const gid=push(ref(db,"groups")).key;
    const membersObj={};members.forEach(uid=>membersObj[uid]=true);membersObj[me.uid]=true;
    await set(ref(db,"groups/"+gid),{name,createdBy:me.uid,members:membersObj,createdAt:Date.now()});
    closeGroupModal();$("groupName").value="";toast("Grupo creado ✅");renderGroups();
  });
  onValue(ref(db,"groups"),snap=>{groupsCache=snap.val()||{};$("statGroups").textContent=Object.values(groupsCache).filter(g=>g.members&&g.members[me.uid]).length;if($("view-groups").classList.contains("active"))renderGroups();});
}
window.closeGroupModal=()=>$("groupModal").classList.add("hidden");
function renderGroups(){
  const mine=Object.entries(groupsCache).filter(([,g])=>g.members&&g.members[me.uid]);
  $("groupsList").innerHTML=mine.length?mine.map(([gid,g])=>`<div class="user-card group-card" onclick="openGroup('${gid}')"><div class="avatar sm group-avatar">👥</div><div class="uc-info"><span class="uc-name">${esc(g.name)}</span><span class="uc-meta">${Object.keys(g.members||{}).length} miembros</span></div></div>`).join(""):'<p class="empty">No tienes grupos.</p>';
}
window.openGroup=gid=>{document.querySelector('[data-view="chats"]').click();openConversation(gid,true);};

function removeTypingNode(){if(typingRef){remove(typingRef).catch(()=>{});typingRef=null;}}
function playSound(){
  if(!settings.sound)return;
  try{const ctx=new (window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator();const g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=700;g.gain.setValueAtTime(.15,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.25);o.start();o.stop(ctx.currentTime+.25);}catch(e){}
}
function browserNotify(title,body){if("Notification" in window&&Notification.permission==="granted"&&document.hidden){try{new Notification(title,{body});}catch(e){}}}

function setupChatUI(){
  $("newChatBtn").addEventListener("click",()=>{
    const list=Object.keys(friends).filter(uid=>!blocked[uid]);
    $("modalFriendList").innerHTML=list.length?list.map(uid=>{const u=usersCache[uid]||{name:"Usuario"};return `<div class="dm-item" onclick="openChat('${uid}');closeModal()"><div class="avatar sm">${esc(avatarInitial(u.name))}</div><div class="dm-info"><span class="dm-name">${esc(u.name)}${vBadge(u)}</span></div></div>`;}).join(""):'<p class="empty">Agrega amigos primero</p>';
    $("friendModal").classList.remove("hidden");
  });
  $("closeModal").addEventListener("click",closeModal);
  $("friendModal").addEventListener("click",e=>{if(e.target.id==="friendModal")closeModal();});
  $("convBack").addEventListener("click",()=>{$("chatConvPanel").classList.remove("open");closeConversation();});
  $("convUserClick").addEventListener("click",()=>{if(activeConv&&!isGroup)openUserModal(activeConv);});
  $("blockBtn").addEventListener("click",()=>{if(!activeConv||isGroup)return;if(confirm("¿Bloquear a este usuario?")){set(ref(db,`blocked/${me.uid}/${activeConv}`),true);toast("Usuario bloqueado");$("chatConvPanel").classList.remove("open");closeConversation();}});
  $("pinConvBtn").addEventListener("click",()=>toggleChatMeta("pinned"));
  $("muteConvBtn").addEventListener("click",()=>toggleChatMeta("muted"));
  $("archiveConvBtn").addEventListener("click",()=>toggleChatMeta("archived"));
  $("chatSearch").addEventListener("input",e=>{const q=e.target.value.toLowerCase();document.querySelectorAll("#dmList .dm-item").forEach(el=>{el.style.display=el.textContent.toLowerCase().includes(q)?"":"none";});});
  $("dmComposer").addEventListener("submit",async e=>{
    e.preventDefault();
    const text=$("dmInput").value.trim();if(!text||!activeConv)return;
    if(hasBannedWords(text)){toast("⚠️ Palabras no permitidas");return;}
    const myName=myProfile.name||me.email.split("@")[0];
    const msgData={fromUid:me.uid,name:myName,text,timestamp:serverTimestamp(),read:false};
    if(replyTo){msgData.replyTo={text:replyTo.text,name:replyTo.name};replyTo=null;cancelReply();}
    const path=isGroup?`messages/group/${activeConvId}`:`messages/private/${activeConvId}`;
    if(!isGroup)msgData.toUid=activeConv;
    await set(push(ref(db,path)),msgData);
    text.match(/@(\w+)/g)?.forEach(m=>{const uname=m.slice(1).toLowerCase();const target=Object.entries(usersCache).find(([,u])=>(u.name||"").toLowerCase().startsWith(uname));if(target&&target[0]!==me.uid)pushNotif(target[0],`${myName} te mencionó en un mensaje`,"💬");});
    $("dmInput").value="";removeTypingNode();clearTimeout(typingTimer);
  });
  $("dmInput").addEventListener("input",()=>{
    if(!activeConvId||isGroup)return;
    if(!$("dmInput").value.trim()){clearTimeout(typingTimer);removeTypingNode();return;}
    typingRef=ref(db,`typing/private/${activeConvId}/${me.uid}`);
    set(typingRef,{name:myProfile.name||me.email.split("@")[0],ts:Date.now()});
    onDisconnect(typingRef).remove();
    clearTimeout(typingTimer);typingTimer=setTimeout(removeTypingNode,2000);
  });
  $("dmInput").addEventListener("blur",()=>{clearTimeout(typingTimer);removeTypingNode();});
}
window.closeModal=()=>$("friendModal").classList.add("hidden");
window.cancelReply=()=>{replyTo=null;$("replyPreview").classList.add("hidden");};
window.setReply=(id,text,name)=>{replyTo={id,text,name};$("replyText").textContent="↩️ "+name+": "+text;$("replyPreview").classList.remove("hidden");$("dmInput").focus();};
window.unpinMessage=async()=>{if(activeConvId){await remove(ref(db,"pinnedMessage/"+activeConvId));$("pinnedBanner").classList.add("hidden");}};
window.pinMessage=async(id,text,name)=>{await set(ref(db,"pinnedMessage/"+activeConvId),{text,name,by:me.uid});toast("Mensaje fijado 📌");};
async function toggleChatMeta(key){
  if(!activeConvId)return;
  const path=`chatMeta/${isGroup?"group":"private"}/${activeConvId}/${me.uid}/${key}`;
  const s=await get(ref(db,path));const val=!s.val();await set(ref(db,path),val);
  if(key==="muted")$("muteConvBtn").classList.toggle("active",val);
  if(key==="pinned")$("pinConvBtn").classList.toggle("active",val);
  toast(val?(key==="muted"?"Chat silenciado 🔕":key==="pinned"?"Chat fijado 📌":"Chat archivado 📦"):(key==="muted"?"Sonido activado 🔔":key==="pinned"?"Chat desfijado":"Chat desarchivado"));
  renderDmList();
}

async function renderDmList(){
  const fids=Object.keys(friends).filter(uid=>!blocked[uid]);
  const gids=Object.entries(groupsCache).filter(([,g])=>g.members&&g.members[me.uid]).map(([gid])=>gid);
  if(!fids.length&&!gids.length){$("dmList").innerHTML='<p class="empty">Agrega amigos o crea un grupo</p>';return;}
  const items=[];
  for(const uid of fids){
    const cid=convId(me.uid,uid);
    const s=await get(query(ref(db,"messages/private/"+cid),orderByChild("timestamp"),limitToLast(1)));
    let last="",unread=0,lastTime=0;
    s.forEach(m=>{const v=m.val();last=v.text;lastTime=v.timestamp||0;});
    const all=await get(ref(db,"messages/private/"+cid));
    all.forEach(m=>{const v=m.val();if(v.toUid===me.uid&&!v.read)unread++;});
    const meta=await get(ref(db,`chatMeta/private/${cid}/${me.uid}`));
    items.push({id:uid,cid,last,unread,lastTime,group:false,meta:meta.val()||{}});
  }
  for(const gid of gids){
    const s=await get(query(ref(db,"messages/group/"+gid),orderByChild("timestamp"),limitToLast(1)));
    let last="",lastTime=0;
    s.forEach(m=>{const v=m.val();last=v.name+": "+v.text;lastTime=v.timestamp||0;});
    items.push({id:gid,cid:gid,last,unread:0,lastTime,group:true,meta:{}});
  }
  items.sort((a,b)=>(b.meta.pinned?1:0)-(a.meta.pinned?1:0)||b.lastTime-a.lastTime);
  const totalUnread=items.reduce((s,i)=>s+i.unread,0);
  const cb=$("chatBadge");if(totalUnread>0){cb.textContent=totalUnread;cb.classList.remove("hidden");}else cb.classList.add("hidden");
  $("dmList").innerHTML=items.map(it=>{
    if(it.group){const g=groupsCache[it.id]||{name:"Grupo"};return `<div class="dm-item ${activeConv===it.id&&isGroup?"active":""}" onclick="openConversation('${it.id}',true)"><div class="avatar sm group-avatar">👥</div><div class="dm-info"><span class="dm-name">${esc(g.name)}</span><span class="dm-last">${esc(it.last||"Sin mensajes")}</span></div>${it.unread?`<span class="dm-unread">${it.unread}</span>`:""}</div>`;}
    const u=usersCache[it.id]||{name:"Usuario"};
    return `<div class="dm-item ${activeConv===it.id&&!isGroup?"active":""}" onclick="openConversation('${it.id}')"><div class="${u.verified?"avatar-ring":""}"><div class="avatar sm">${esc(avatarInitial(u.name))}</div></div><div class="dm-info"><span class="dm-name">${esc(u.name)}${vBadge(u)}${it.meta.pinned?" 📌":""}${it.meta.muted?" 🔕":""}</span><span class="dm-last">${esc(it.last||"Sin mensajes")}</span></div>${it.unread?`<span class="dm-unread">${it.unread}</span>`:""}</div>`;
  }).join("");
}

window.openConversation=async(uid,group=false)=>{
  if(unsubDm)unsubDm();if(unsubTyping)unsubTyping();
  removeTypingNode();clearTimeout(typingTimer);
  activeConv=uid;isGroup=group;activeConvId=group?uid:convId(me.uid,uid);
  replyTo=null;cancelReply();
  if(group){const g=groupsCache[uid]||{name:"Grupo"};$("convName").textContent=g.name;$("convAvatar").textContent="👥";$("convAvatar").classList.add("group-avatar");$("convStatus").textContent=Object.keys(g.members||{}).length+" miembros";$("blockBtn").style.display="none";}
  else{const u=usersCache[uid]||{name:"Usuario"};$("convName").innerHTML=esc(u.name)+vBadge(u);$("convAvatar").textContent=avatarInitial(u.name);$("convAvatar").classList.remove("group-avatar");$("blockBtn").style.display="";updateConvStatus();}
  $("convPlaceholder").classList.add("hidden");$("convActive").classList.remove("hidden");$("chatConvPanel").classList.add("open");
  $("dmMessages").innerHTML="";
  get(ref(db,"pinnedMessage/"+activeConvId)).then(s=>{
    if(s.exists()){$("pinnedText").textContent=s.val().name+": "+s.val().text;$("pinnedBanner").classList.remove("hidden");}else $("pinnedBanner").classList.add("hidden");
  });
  const path=isGroup?`messages/group/${activeConvId}`:`messages/private/${activeConvId}`;
  if(!isGroup){
    const all=await get(ref(db,path));const upd={};all.forEach(m=>{const v=m.val();if(v.toUid===me.uid&&!v.read)upd[`${path}/${m.key}/read`]=true;});if(Object.keys(upd).length)await update(ref(db),upd);
    const typSnap=await get(ref(db,"typing/private/"+activeConvId));
    if(typSnap.exists())typSnap.forEach(t=>{if(Date.now()-(t.val().ts||0)>5000)remove(ref(db,`typing/private/${activeConvId}/${t.key}`)).catch(()=>{});});
  }
  let firstLoad=true;
  unsubDm=onValue(ref(db,path),snap=>{
    const msgs=Object.entries(snap.val()||{}).map(([id,m])=>({id,...m})).sort((a,b)=>(a.timestamp||0)-(b.timestamp||0));
    if(!firstLoad&&msgs.length&&!document.hidden){const last=msgs[msgs.length-1];if(last.fromUid!==me.uid){playSound();browserNotify("💬 Nuevo mensaje",last.name+": "+(last.text||"").slice(0,40));}}
    firstLoad=false;
    $("dmMessages").innerHTML="";
    const upd={};
    msgs.forEach(m=>{renderDmMessage(m.id,m);if(!isGroup&&m.toUid===me.uid&&!m.read)upd[`${path}/${m.id}/read`]=true;});
    if(Object.keys(upd).length)update(ref(db),upd);
    $("dmMessages").scrollTop=$("dmMessages").scrollHeight;
  });
  if(!isGroup){
    unsubTyping=onValue(ref(db,"typing/private/"+activeConvId),snap=>{
      const data=snap.val()||{};
      const other=Object.entries(data).find(([id,v])=>id!==me.uid&&v&&v.name&&(Date.now()-(v.ts||0)<5000));
      if(other){$("dmTypingName").textContent=other[1].name+" está escribiendo…";$("dmTyping").hidden=false;}else $("dmTyping").hidden=true;
    });
  }else $("dmTyping").hidden=true;
  renderDmList();
};
function closeConversation(){
  removeTypingNode();clearTimeout(typingTimer);
  if(unsubDm){unsubDm();unsubDm=null;}if(unsubTyping){unsubTyping();unsubTyping=null;}
  activeConv=null;activeConvId=null;isGroup=false;
  $("convActive").classList.add("hidden");$("convPlaceholder").classList.remove("hidden");
}
function updateConvStatus(){
  if(!activeConv)return;const el=$("convStatus");const u=usersCache[activeConv]||{};
  if(onlineUsers[activeConv]){el.textContent="En línea";el.classList.remove("off");}
  else{el.textContent=(u.status?esc(u.status)+" · ":"")+"últ. vez "+(u.lastSeen?timeAgo(u.lastSeen):"hace un rato");el.classList.add("off");}
}
function renderDmMessage(id,msg){
  const isMe=msg.fromUid===me.uid;
  const row=document.createElement("div");
  row.className="msg-row"+(isMe?" me":"");
  const reactions=msg.reactions||{};
  const myReacts=Object.entries(reactions).filter(([,v])=>v&&v[me.uid]).map(([e])=>e);
  const reactChips=Object.entries(reactions).filter(([,v])=>v&&Object.keys(v).length).map(([e,v])=>`<span class="reaction-chip" onclick="toggleReaction('${id}','${e}')">${e} ${Object.keys(v).length}</span>`).join("");
  const replyQuote=msg.replyTo?`<div class="msg-reply-quote">↩️ ${esc(msg.replyTo.name)}: ${esc(msg.replyTo.text)}</div>`:"";
  row.innerHTML=`<div class="avatar msg-avatar">${esc(avatarInitial(msg.name))}</div>
    <div class="bubble">${replyQuote}${!isMe?`<div style="font-size:11px;font-weight:700;color:var(--primary-dark);margin-bottom:2px">${esc(msg.name||"")}</div>`:""}<span>${esc(msg.text)}</span><span class="msg-time">${msg.timestamp?formatTime(msg.timestamp):""}</span>${isMe?`<span class="read-receipt">${msg.read?"✓✓":"✓"}</span>`:""}${reactChips?`<div class="msg-reactions">${reactChips}</div>`:""}</div>
    <div class="msg-actions">
      ${REACTIONS.filter(r=>!myReacts.includes(r)).slice(0,3).map(r=>`<button onclick="toggleReaction('${id}','${r}')" title="Reaccionar">${r}</button>`).join("")}
      <button onclick="setReply('${id}','${esc(msg.text).slice(0,40)}','${esc(msg.name)}')" title="Responder">↩️</button>
      <button onclick="pinMessage('${id}','${esc(msg.text).slice(0,50)}','${esc(msg.name)}')" title="Fijar">📌</button>
      ${isMe?`<button onclick="deleteMsg('${id}')" title="Eliminar">🗑</button>`:""}
    </div>`;
  $("dmMessages").appendChild(row);
}
window.toggleReaction=async(msgId,emoji)=>{
  if(!activeConvId)return;
  const path=`${isGroup?"messages/group":"messages/private"}/${activeConvId}/${msgId}/reactions/${emoji}/${me.uid}`;
  const s=await get(ref(db,path));
  if(s.exists())await remove(ref(db,path));else await set(ref(db,path),true);
};
window.deleteMsg=async id=>{if(confirm("¿Eliminar mensaje?")){const path=`${isGroup?"messages/group":"messages/private"}/${activeConvId}/${id}`;await remove(ref(db,path));toast("Mensaje eliminado");}};

window.openUserModal=async uid=>{
  const u=usersCache[uid]||{};const name=u.name||"Usuario";const isFriend=friends[uid];
  const posts=Object.entries((await get(ref(db,"posts"))).val()||{}).map(([id,p])=>({id,...p})).filter(p=>p.uid===uid).slice(0,5);
  const friendCount=Object.keys((await get(ref(db,"friends/"+uid))).val()||{}).length;
  let actions=isFriend?`<button class="btn-ghost" onclick="openChat('${uid}');closeUserModal()">💬 Mensaje</button>`:`<button class="btn-ghost" onclick="sendReq('${uid}')">🤝 Agregar amigo</button>`;
  actions+=`<button class="btn-danger-ghost" onclick="openReport('user','${uid}')">⚠️ Reportar</button>`;
  $("userModalBody").innerHTML=`<div class="ump-head"><div class="avatar big" style="margin:0 auto 10px">${esc(avatarInitial(name))}</div><h3 style="display:inline-flex;align-items:center">${esc(name)}${vBadge(u)}</h3><p style="color:var(--soft);font-size:13px;margin-top:4px">${esc(u.email||"")}</p><p style="margin-top:6px;font-size:13px;color:var(--primary-dark);font-weight:600">✨ ${esc(u.status||"Disponible")}</p><p style="margin-top:8px;font-size:14px">${esc(u.bio||"Sin biografía")}</p></div>
    <div class="ump-stats"><div><b>${posts.length}</b><span>Posts</span></div><div><b>${friendCount}</b><span>Amigos</span></div><div><b>${u.createdAt?new Date(u.createdAt).toLocaleDateString():"—"}</b><span>Desde</span></div></div>
    <div class="ump-actions">${actions}</div>
    <div class="ump-posts"><h4 style="margin-bottom:10px;font-size:13px;color:var(--soft)">Publicaciones recientes</h4>${posts.length?posts.map(p=>`<div class="post" style="margin-bottom:10px"><div class="post-text" style="padding:12px 14px;font-size:13.5px">${esc(p.text)}</div></div>`).join(""):'<p class="empty">Sin publicaciones</p>'}</div>`;
  $("userModal").classList.remove("hidden");
};
window.closeUserModal=()=>$("userModal").classList.add("hidden");

window.openReport=(type,id)=>{reportType=type;reportTarget=id;$("reportModal").classList.remove("hidden");};
window.closeReport=()=>$("reportModal").classList.add("hidden");
$("sendReport").addEventListener("click",async()=>{
  const reason=$("reportReason").value;const details=$("reportDetails").value.trim();
  await set(push(ref(db,"reports")),{type:reportType,targetId:reportTarget,reason,details,reportedBy:me.uid,timestamp:Date.now(),status:"pending"});
  closeReport();$("reportDetails").value="";toast("Reporte enviado ✅");
});

function setupAnnouncement(){onValue(ref(db,"settings/announcement"),snap=>{if(snap.exists()&&snap.val()){$("annText").textContent="📢 "+snap.val();$("announcement").classList.remove("hidden");}else $("announcement").classList.add("hidden");});}

function setupEmojiPicker(){
  const picker=$("emojiPicker");
  picker.innerHTML=EMOJIS.map(e=>`<button type="button">${e}</button>`).join("");
  picker.addEventListener("click",e=>{if(e.target.tagName!=="BUTTON")return;if(emojiTarget){const inp=$(emojiTarget);inp.value+=e.target.textContent;inp.focus();}picker.classList.add("hidden");});
  document.querySelectorAll(".emoji-trigger").forEach(btn=>btn.addEventListener("click",e=>{e.stopPropagation();emojiTarget=btn.dataset.target;picker.classList.toggle("hidden");const r=btn.getBoundingClientRect();picker.style.bottom=(window.innerHeight-r.top+10)+"px";picker.style.left=Math.min(r.left,window.innerWidth-340)+"px";}));
  document.addEventListener("click",e=>{if(!e.target.closest(".emoji-picker")&&!e.target.closest(".emoji-trigger"))picker.classList.add("hidden");});
}

function setupSettings(){
  settings.sound=localStorage.getItem("inside-sound")!=="off";
  $("swSound").classList.toggle("on",settings.sound);
  window.toggleSound=()=>{settings.sound=!settings.sound;localStorage.setItem("inside-sound",settings.sound?"on":"off");$("swSound").classList.toggle("on",settings.sound);toast(settings.sound?"🔔 Sonido activado":"🔕 Sonido desactivado");};
  $("enableNotifBtn").addEventListener("click",async()=>{
    if(!("Notification" in window)){toast("Navegador no soporta notificaciones");return;}
    const perm=await Notification.requestPermission();
    if(perm==="granted"){$("enableNotifBtn").textContent="✅ Activadas";toast("Notificaciones activadas");}else toast("Permiso denegado");
  });
  window.exportMyData=async()=>{
    const [postsSnap,friendsSnap,notifSnap]=await Promise.all([get(ref(db,"posts")),get(ref(db,"friends/"+me.uid)),get(ref(db,"notifications/"+me.uid))]);
    const myPosts=Object.entries(postsSnap.val()||{}).filter(([,p])=>p.uid===me.uid);
    const data={profile:myProfile,posts:myPosts,friends:Object.keys(friendsSnap.val()||{}),notifications:notifSnap.val()||{},exportedAt:new Date().toISOString()};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="mis-datos-inside.json";a.click();
    toast("Datos descargados ✅");
  };
  window.unblockUser=async uid=>{await remove(ref(db,`blocked/${me.uid}/${uid}`));toast("Usuario desbloqueado");renderBlockedList();};
}
function renderBlockedList(){
  const list=Object.keys(blocked).map(uid=>[uid,usersCache[uid]||{name:"Usuario"}]);
  $("blockedList").innerHTML=list.length?list.map(([uid,u])=>`<div class="user-card"><div class="avatar sm">${esc(avatarInitial(u.name))}</div><div class="uc-info"><span class="uc-name">${esc(u.name)}</span><span class="uc-meta">Bloqueado</span></div><div class="uc-actions"><button class="btn-ghost" onclick="unblockUser('${uid}')">Desbloquear</button></div></div>`).join(""):'<p class="empty">No has bloqueado a nadie.</p>';
}

function renderProfile(){
  const name=myProfile.name||me.email.split("@")[0];
  $("profileName").innerHTML=esc(name)+vBadge(myProfile);
  $("profileEmail").textContent=me.email;
  $("profileStatus").textContent="✨ "+(myProfile.status||"Disponible");
  $("profileBio").textContent=myProfile.bio||"Sin biografía";
  $("profileAvatar").textContent=avatarInitial(name);
  $("editName").value=name;$("editStatus").value=myProfile.status||"";$("editBio").value=myProfile.bio||"";
}
function setupProfileEdit(){
  $("saveProfileBtn").addEventListener("click",async()=>{
    const name=$("editName").value.trim()||me.email.split("@")[0];const bio=$("editBio").value.trim();const status=$("editStatus").value.trim();
    await update(ref(db,"users/"+me.uid),{name,bio,status});
    await updateProfile(me,{displayName:name}).catch(()=>{});
    myProfile.name=name;myProfile.bio=bio;myProfile.status=status;
    $("sideName").innerHTML=esc(name)+vBadge(myProfile);$("sideAvatar").textContent=avatarInitial(name);$("feedAvatar").textContent=avatarInitial(name);
    renderProfile();$("saveOk").classList.remove("hidden");setTimeout(()=>$("saveOk").classList.add("hidden"),2000);toast("Perfil actualizado ✅");
  });
}
function loadMyPosts(){
  onValue(ref(db,"posts"),snap=>{
    const mine=Object.entries(snap.val()||{}).map(([id,p])=>({id,...p})).filter(p=>p.uid===me.uid).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
    $("statPosts").textContent=mine.length;renderPosts($("myPosts"),mine);
  });
}

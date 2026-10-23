// notif.js — Gestor real de notificaciones del navegador
let permission = typeof Notification !== "undefined" ? Notification.permission : "denied";

export function notificationSupported(){
  return typeof Notification !== "undefined";
}

export function getPermission(){ return permission; }

export async function requestPermission(){
  if(!notificationSupported()) return "unsupported";
  permission = await Notification.requestPermission();
  return permission;
}

export function sendNotification(title, body, options = {}){
  if(!notificationSupported() || permission !== "granted") return false;
  if(!document.hidden && options.onlyWhenHidden !== false) return false;
  try{
    const n = new Notification(title, {
      body: body || "",
      icon: options.icon || "/icon-192.png",
      badge: options.badge || "/icon-192.png",
      tag: options.tag || "inside",
      renotify: options.renotify || false,
      silent: options.silent || false
    });
    if(options.onClick){
      n.onclick = (e) => { e.preventDefault(); window.focus(); options.onClick(); n.close(); };
    } else {
      n.onclick = () => { window.focus(); n.close(); };
    }
    if(options.autoClose !== false){
      setTimeout(() => n.close(), options.duration || 5000);
    }
    return true;
  }catch(e){
    return false;
  }
}

export function vibrate(pattern = [200, 100, 200]){
  if(navigator.vibrate){ try { navigator.vibrate(pattern); } catch(e){} }
}

export function setBadge(count){
  if(navigator.setAppBadge){
    try { navigator.setAppBadge(Math.min(count || 0, 999)).catch(() => {}); } catch(e){}
  }
  document.title = count > 0 ? `(${count}) Inside` : "Inside";
}

export function clearBadge(){
  if(navigator.clearAppBadge){ try { navigator.clearAppBadge().catch(() => {}); } catch(e){} }
  document.title = "Inside";
}

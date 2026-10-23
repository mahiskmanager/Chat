// router.js — Router de vistas SPA real con historial
const routes = {};
let currentRoute = null;

export function registerRoute(name, { render, onEnter, onLeave }){
  routes[name] = { render, onEnter, onLeave };
}

export async function navigate(name, params){
  if(currentRoute && routes[currentRoute] && routes[currentRoute].onLeave){
    try { await routes[currentRoute].onLeave(); } catch(e){}
  }
  if(!routes[name]){ console.warn("Ruta no encontrada:", name); return; }
  currentRoute = name;
  try{
    if(routes[name].onEnter) await routes[name].onEnter(params);
    if(routes[name].render) await routes[name].render(params);
    if(window.history && window.history.pushState){
      window.history.pushState({ view: name }, "", "#" + name);
    }
  }catch(e){
    console.error("Error en ruta", name, e);
  }
}

export function getCurrentRoute(){ return currentRoute; }

export function initRouter(defaultRoute){
  window.addEventListener("popstate", (e) => {
    const view = (e.state && e.state.view) || location.hash.slice(1) || defaultRoute;
    if(view !== currentRoute && routes[view]) navigate(view);
  });
  const initial = location.hash.slice(1) || defaultRoute;
  if(routes[initial]) navigate(initial);
}

export function goBack(){ window.history.back(); }

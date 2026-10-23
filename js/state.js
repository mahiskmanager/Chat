// state.js — Store reactivo simple con suscripciones
const state = {};
const listeners = {};

export function getState(key){
  return key === undefined ? { ...state } : state[key];
}

export function setState(key, value){
  const old = state[key];
  state[key] = value;
  if(old !== value && listeners[key]){
    listeners[key].forEach(fn => { try { fn(value, old); } catch(e){ console.error(e); } });
  }
}

export function subscribe(key, fn){
  if(!listeners[key]) listeners[key] = [];
  listeners[key].push(fn);
  return () => { listeners[key] = listeners[key].filter(f => f !== fn); };
}

export function increment(key, amount = 1){
  setState(key, (state[key] || 0) + amount);
}

export function toggle(key){
  setState(key, !state[key]);
}

export function resetState(){
  Object.keys(state).forEach(k => delete state[k]);
  Object.keys(listeners).forEach(k => delete listeners[k]);
}

// Estado persistente (localStorage)
const PERSIST_KEY = "inside_state";
export function loadPersistedState(){
  try{
    const raw = localStorage.getItem(PERSIST_KEY);
    if(raw){ const data = JSON.parse(raw); Object.assign(state, data); }
  }catch(e){}
}
export function persistState(keys){
  try{
    const data = {};
    (keys || Object.keys(state)).forEach(k => { if(state[k] !== undefined) data[k] = state[k]; });
    localStorage.setItem(PERSIST_KEY, JSON.stringify(data));
  }catch(e){}
}

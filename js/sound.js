// sound.js — Motor de sonido real con Web Audio API (sin archivos externos)
let audioCtx = null;
let enabled = true;

function getCtx(){
  if(!audioCtx){
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    audioCtx = new AC();
  }
  if(audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

export function setSoundEnabled(v){ enabled = !!v; }
export function isSoundEnabled(){ return enabled; }

function tone(freq, duration, type = "sine", volume = 0.15, delay = 0){
  if(!enabled) return;
  const ctx = getCtx();
  if(!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const start = ctx.currentTime + delay;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(start); osc.stop(start + duration + 0.05);
}

export const Sounds = {
  message(){ tone(740, 0.12, "sine", 0.12); tone(988, 0.18, "sine", 0.1, 0.08); },
  send(){ tone(523, 0.08, "triangle", 0.1); },
  receive(){ tone(659, 0.1, "sine", 0.12); tone(880, 0.15, "sine", 0.1, 0.07); },
  like(){ tone(880, 0.08, "sine", 0.1); tone(1175, 0.12, "sine", 0.08, 0.05); },
  comment(){ tone(587, 0.1, "triangle", 0.1); },
  success(){ tone(523, 0.1, "sine", 0.12); tone(659, 0.1, "sine", 0.12, 0.1); tone(784, 0.18, "sine", 0.12, 0.2); },
  error(){ tone(220, 0.15, "sawtooth", 0.08); tone(180, 0.2, "sawtooth", 0.08, 0.1); },
  notification(){ tone(988, 0.08, "sine", 0.12); tone(1319, 0.12, "sine", 0.1, 0.06); },
  typing(){ tone(440, 0.03, "sine", 0.05); },
  story(){ tone(659, 0.1, "sine", 0.1); tone(784, 0.1, "sine", 0.1, 0.08); tone(988, 0.15, "sine", 0.1, 0.16); },
  poll(){ tone(523, 0.08, "triangle", 0.1); tone(659, 0.08, "triangle", 0.1, 0.06); tone(784, 0.12, "triangle", 0.1, 0.12); },
  delete(){ tone(330, 0.1, "sawtooth", 0.08); tone(220, 0.15, "sawtooth", 0.08, 0.08); },
  click(){ tone(600, 0.03, "square", 0.04); },
  pop(){ tone(800, 0.05, "sine", 0.08); }
};

export function playSound(name){
  if(Sounds[name]) Sounds[name]();
}

// Desbloquear audio en móviles tras primera interacción
if(typeof window !== "undefined"){
  const unlock = () => { getCtx(); window.removeEventListener("touchstart", unlock); window.removeEventListener("click", unlock); };
  window.addEventListener("touchstart", unlock, { once: true });
  window.addEventListener("click", unlock, { once: true });
}

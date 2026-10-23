// validators.js — Validación de formularios real
export function validateEmail(email){
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(String(email || "").toLowerCase());
}

export function validatePassword(pwd){
  if(!pwd || pwd.length < 6) return { ok: false, msg: "Mínimo 6 caracteres" };
  if(pwd.length > 128) return { ok: false, msg: "Máximo 128 caracteres" };
  return { ok: true };
}

export function validateName(name){
  if(!name || !name.trim()) return { ok: false, msg: "El nombre es obligatorio" };
  if(name.trim().length < 2) return { ok: false, msg: "Nombre muy corto" };
  if(name.trim().length > 20) return { ok: false, msg: "Máximo 20 caracteres" };
  return { ok: true };
}

export function validatePost(text, max = 500){
  if(!text || !text.trim()) return { ok: false, msg: "Escribe algo" };
  if(text.length > max) return { ok: false, msg: `Máximo ${max} caracteres` };
  return { ok: true };
}

export function validateGroupName(name){
  if(!name || !name.trim()) return { ok: false, msg: "Nombre obligatorio" };
  if(name.trim().length < 3) return { ok: false, msg: "Mínimo 3 caracteres" };
  if(name.trim().length > 30) return { ok: false, msg: "Máximo 30 caracteres" };
  return { ok: true };
}

export function containsBannedWords(text, bannedList){
  const low = String(text || "").toLowerCase();
  return (bannedList || []).some(w => w && low.includes(String(w).toLowerCase()));
}

export function extractHashtags(text){
  return Array.from(new Set((String(text || "").match(/#[\wáéíóúüñ]+/gi) || []).map(t => t.toLowerCase())));
}

export function extractMentions(text){
  return Array.from(new Set((String(text || "").match(/@[\wáéíóúüñ]+/gi) || []).map(t => t.slice(1).toLowerCase())));
}

export function sanitizeText(text, maxLength){
  let t = String(text || "").trim();
  t = t.replace(/\s+/g, " ");
  if(maxLength) t = t.slice(0, maxLength);
  return t;
}

export function isStrongPassword(pwd){
  const checks = {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    number: /\d/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd)
  };
  const score = Object.values(checks).filter(Boolean).length;
  return { score, checks, level: score >= 4 ? "strong" : score >= 3 ? "medium" : "weak" };
}

export function passwordStrengthLabel(score){
  return ["Muy débil","Débil","Regular","Buena","Fuerte","Muy fuerte"][Math.min(score, 5)] || "Muy débil";
}

export function validatePollOptions(options){
  const filled = (options || []).map(o => String(o || "").trim()).filter(Boolean);
  if(filled.length < 2) return { ok: false, msg: "Mínimo 2 opciones" };
  if(filled.length > 4) return { ok: false, msg: "Máximo 4 opciones" };
  if(new Set(filled.map(o => o.toLowerCase())).size !== filled.length) return { ok: false, msg: "Opciones repetidas" };
  if(filled.some(o => o.length > 40)) return { ok: false, msg: "Opción muy larga (máx 40)" };
  return { ok: true, options: filled };
}

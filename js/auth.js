// Inside v3.0 — Autenticación (con baneo y registros cerrados)
import { auth, db, showAlert, applyTheme } from "./firebase-config.js";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { ref, set, get } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";

applyTheme();
const isRegister = !!document.getElementById("registerForm");
const form = isRegister ? document.getElementById("registerForm") : document.getElementById("loginForm");
const alertBox = document.getElementById("alertBox");
const btn = form.querySelector("button");
const btnText = btn.querySelector(".btn-text");
const spinner = btn.querySelector(".spinner");

onAuthStateChanged(auth, (user) => { if (user) location.replace("home.html"); });

// Verificar si los registros están cerrados por el admin
if (isRegister) {
  get(ref(db, "settings/registrationsOpen")).then(s => {
    if (s.exists() && s.val() === false) {
      document.getElementById("regClosed").classList.remove("hidden");
      btn.disabled = true;
    }
  });
}

function setLoading(on, label){btn.disabled=on;spinner.classList.toggle("hidden",!on);if(label)btnText.textContent=label;}
function friendlyError(code){
  const m={"auth/invalid-credential":"Correo o contraseña incorrectos.","auth/user-not-found":"No existe una cuenta con ese correo.","auth/wrong-password":"Contraseña incorrecta.","auth/email-already-in-use":"Ese correo ya está registrado.","auth/invalid-email":"El correo no es válido.","auth/weak-password":"La contraseña debe tener al menos 6 caracteres.","auth/network-request-failed":"Sin conexión a internet.","auth/too-many-requests":"Demasiados intentos. Intenta más tarde."};
  return m[code]||"Ocurrió un error. Inténtalo de nuevo.";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  alertBox.classList.add("hidden");
  setLoading(true, isRegister?"Creando cuenta…":"Entrando…");
  const email=document.getElementById("email").value.trim();
  const password=document.getElementById("password").value;
  try {
    let user;
    if (isRegister) {
      const displayName=document.getElementById("displayName").value.trim();
      const cred=await createUserWithEmailAndPassword(auth,email,password);
      await updateProfile(cred.user,{displayName});
      await set(ref(db,"users/"+cred.user.uid),{name:displayName,bio:"",email,createdAt:Date.now(),verified:false,banned:false});
      user=cred.user;
    } else {
      const cred=await signInWithEmailAndPassword(auth,email,password);
      user=cred.user;
    }
    // Verificar baneo
    const u=await get(ref(db,"users/"+user.uid));
    if (u.exists() && u.val().banned) {
      await signOut(auth);
      document.getElementById("banBox").classList.remove("hidden");
      setLoading(false,"Entrar");
      return;
    }
    location.replace("home.html");
  } catch(err){
    showAlert(alertBox,"error",friendlyError(err.code));
    alertBox.classList.remove("hidden");
    setLoading(false,isRegister?"Crear cuenta":"Entrar");
  }
});

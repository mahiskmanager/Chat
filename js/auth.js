// Inside — Autenticación (login / registro)
import { auth, db, showAlert } from "./firebase-config.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js";

const isRegister = document.getElementById("registerForm") !== null;
const form = isRegister ? document.getElementById("registerForm") : document.getElementById("loginForm");
const alertBox = document.getElementById("alertBox");
const btn = form.querySelector("button");
const btnText = btn.querySelector(".btn-text");
const spinner = btn.querySelector(".spinner");

onAuthStateChanged(auth, (user) => { if (user) location.replace("home.html"); });

function setLoading(loading, label) {
  btn.disabled = loading;
  spinner.classList.toggle("hidden", !loading);
  if (label) btnText.textContent = label;
}

function friendlyError(code) {
  const map = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/email-already-in-use": "Ese correo ya está registrado.",
    "auth/invalid-email": "El correo no es válido.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/network-request-failed": "Sin conexión a internet. Revisa tu red.",
    "auth/too-many-requests": "Demasiados intentos. Intenta más tarde."
  };
  return map[code] || "Ocurrió un error. Inténtalo de nuevo.";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  alertBox.classList.add("hidden");
  setLoading(true, isRegister ? "Creando cuenta…" : "Entrando…");
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    if (isRegister) {
      const displayName = document.getElementById("displayName").value.trim();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });
      await set(ref(db, "users/" + cred.user.uid), {
        name: displayName, bio: "", email, createdAt: Date.now(), verified: false
      });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    location.replace("home.html");
  } catch (err) {
    showAlert(alertBox, "error", friendlyError(err.code));
    alertBox.classList.remove("hidden");
    setLoading(false, isRegister ? "Crear cuenta" : "Entrar");
  }
});

# Inside v2.0 — Red Social + Chat (ZIP 1/2)

App social estilo Instagram: feed de publicaciones, verificación con palomita azul (se gestiona desde el panel admin), búsqueda de usuarios, solicitudes de amistad, chat privado 1-a-1 y perfil editable. **Sin fotos, sin Storage.**

## Pasos en Firebase Console
1. **Authentication** → habilitar Correo/contraseña.
2. **Realtime Database → Reglas** (incluye nodo `verified` y `admins`):
```json
{
  "rules": {
    "users": { "$uid": { ".read": "auth != null", ".write": "auth.uid === $uid || root.child('admins/'+auth.uid).exists()" } },
    "posts": { ".read": "auth != null", "$postId": { ".write": "auth != null && (!data.exists() || data.child('uid').val() === auth.uid || root.child('admins/'+auth.uid).exists())", "likes": { "$uid": { ".write": "auth != null" } } } },
    "friends": { "$uid": { ".read": "auth.uid === $uid", ".write": "auth != null" } },
    "friendRequests": { "incoming": { "$toUid": { ".read": "auth.uid === $toUid", ".write": "auth != null" } }, "sent": { "$fromUid": { ".read": "auth.uid === $fromUid", ".write": "auth != null" } } },
    "messages": { "private": { "$convId": { ".read": "auth != null && $convId.contains(auth.uid)", ".write": "auth != null && $convId.contains(auth.uid)" } } },
    "presence": { ".read": "auth != null", "$uid": { ".write": "auth.uid === $uid" } },
    "typing": { ".read": "auth != null", ".write": "auth != null" },
    "admins": { ".read": false, ".write": false },
    "adminEmails": { ".read": false, ".write": false }
  }
}
```
3. Abrir `index.html` y registrarse. La palomita azul aparece solo si un admin verificó la cuenta desde el panel.

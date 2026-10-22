# Inside v3.0 — Red Social (ZIP 1/2)

Funciones: feed con likes, comentarios, historias de texto (24h), notificaciones, publicaciones guardadas, búsqueda, sugerencias de amigos, solicitudes de amistad, chat privado (con "está escribiendo…", recibos de lectura ✓✓, eliminar mensajes, buscar en chats), perfil editable, perfil de otros usuarios, bloquear usuarios, reportar (al admin), anuncios globales del admin, tema oscuro, verificación con palomita azul (gestionada desde el panel admin).

## Reglas Realtime Database (pegar en Firebase Console):
```json
{
  "rules": {
    "users": { "$uid": { ".read": "auth != null", ".write": "auth.uid === $uid || root.child('admins/'+auth.uid).exists()" } },
    "posts": { ".read": "auth != null", "$postId": { ".write": "auth != null && (!data.exists() || data.child('uid').val() === auth.uid || root.child('admins/'+auth.uid).exists())", "comments": { ".read": "auth != null", ".write": "auth != null" }, "likes": { "$uid": { ".write": "auth != null" } }, "saved": { "$uid": { ".write": "auth != null" } } } },
    "stories": { ".read": "auth != null", "$id": { ".write": "auth != null && (!data.exists() || data.child('uid').val() === auth.uid)" } },
    "friends": { "$uid": { ".read": "auth.uid === $uid", ".write": "auth != null" } },
    "friendRequests": { "incoming": { "$toUid": { ".read": "auth.uid === $toUid", ".write": "auth != null" } }, "sent": { "$fromUid": { ".read": "auth.uid === $fromUid", ".write": "auth != null" } } },
    "messages": { "private": { "$convId": { ".read": "auth != null && $convId.contains(auth.uid)", ".write": "auth != null && $convId.contains(auth.uid)" } } },
    "presence": { ".read": "auth != null", "$uid": { ".write": "auth.uid === $uid" } },
    "typing": { ".read": "auth != null", ".write": "auth != null" },
    "notifications": { "$uid": { ".read": "auth.uid === $uid", ".write": "auth != null" } },
    "blocked": { "$uid": { ".read": "auth.uid === $uid", ".write": "auth.uid === $uid" } },
    "reports": { ".write": "auth != null", ".read": false },
    "settings": { ".read": "auth != null", ".write": false },
    "admins": { ".read": false, ".write": false },
    "adminEmails": { ".read": false, ".write": false },
    "auditLog": { ".read": false, ".write": false }
  }
}
```
Abrir `index.html` y registrarse.

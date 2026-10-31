# Orbit Chat 1.2 — Android + respaldo local

Este proyecto contiene el servidor web (Express/Socket.IO/sql.js), el frontend adaptable a móvil y la configuración Capacitor para generar un APK Android. El APK necesita conectarse a un servidor Orbit Chat público: al abrirlo, escribe la URL HTTPS del servidor en el campo **Servidor de Orbit Chat**.

## 1. Ejecutar el servidor en Termux

```bash
npm install
npm start
```

Para usarlo con amigos desde Internet, despliega este mismo proyecto como servicio Node.js con almacenamiento persistente (el `render.yaml` incluido configura Render). No uses almacenamiento efímero para la base de datos ni las subidas.

## 2. Generar el APK usando solo el Redmi

La compilación Android se realiza gratis en GitHub Actions; Termux solo prepara y sube el proyecto. No hace falta instalar Android Studio en el teléfono.

1. Crea un repositorio en https://github.com/new llamado `orbit-chat`.
2. En Termux, dentro de esta carpeta del proyecto, ejecuta (cambia `TU_USUARIO` por tu usuario de GitHub):

```bash
pkg install git
 git init
 git add .
 git commit -m "Orbit Chat Android"
 git branch -M main
 git remote add origin https://github.com/TU_USUARIO/orbit-chat.git
 git push -u origin main
```

Si Git pide identidad:

```bash
git config --global user.name "Orbit Chat"
git config --global user.email "TU_CORREO_DE_GITHUB"
```

GitHub puede pedir autenticación por navegador/token. No pegues tokens en chats ni los compartas.

3. En GitHub abre el repositorio → **Actions** → **Build Orbit Chat APK** → **Run workflow** (o espera a que termine el flujo que se activa al subir `main`).
4. Abre la ejecución completada, baja **orbit-chat-debug-apk** en Artifacts y extrae `app-debug.apk`.
5. Abre el APK en Android y permite instalar desde esa fuente si Android lo solicita.

Cada cambio que subas a `main` vuelve a compilar el APK.

## 3. Copia local de mensajes

Al iniciar sesión, Orbit Chat guarda automáticamente en IndexedDB una copia local de los mensajes que se descargan o reciben en ese dispositivo. Al abrir una conversación sin conexión, muestra los mensajes que tenga guardados localmente.

En el perfil hay dos botones: flecha hacia abajo para exportar un JSON y flecha hacia arriba para importarlo. Las copias contienen mensajes y metadatos de conversación, no contraseñas. Por ahora no incluyen los bytes de fotos, vídeos o audios; esos archivos siguen alojados en el servidor. Guarda el JSON en un lugar privado: contiene conversaciones personales.

La copia local no reemplaza el respaldo del servidor. Si borras los datos de la aplicación, el caché local puede desaparecer; exporta regularmente.

## 4. Configuración de conexión

En la pantalla de acceso, en **Servidor de Orbit Chat**, escribe la URL HTTPS que Render (u otro host) asigne a tu servidor, por ejemplo `https://tu-orbit-chat.onrender.com`. No uses `localhost` para hablar con amigos por Internet.

## Notas

- El APK de este workflow es una compilación debug para pruebas, no una versión firmada de Play Store.
- Las conexiones en tiempo real usan Socket.IO; PeerJS no es necesario para mensajes. Puede añadirse luego para llamadas P2P.
- El almacenamiento local de mensajes es por dispositivo y por cuenta iniciada.

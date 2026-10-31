# Orbit Chat 1.3.1 — Android + respaldo local

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

## 5. Mejoras de la versión 1.3

- Editor de perfil con nombre visible y descripción; el nombre de acceso sigue siendo el mismo para no romper las cuentas existentes.
- La foto de perfil puede elegirse desde la galería del dispositivo en Android.
- El botón de adjuntar muestra un selector dentro de Orbit Chat para elegir entre fotos/vídeos y otros archivos. En Android, fotos y vídeos se seleccionan desde la galería del sistema; los documentos desde el selector de archivos.
- Los mensajes consecutivos del mismo usuario se agrupan visualmente.
- El chat conserva la posición de lectura si estás revisando mensajes anteriores y solo baja automáticamente cuando ya estabas al final.
- Avisos dentro de la app y notificaciones del sistema cuando el permiso está disponible. Las notificaciones de sistema no son push garantizadas si Android suspende o cierra la app; para eso haría falta configurar un servicio push.
- Se amplió la carga de archivos comunes (PDF, documentos, hojas de cálculo, presentaciones y archivos de texto), manteniendo el límite de 10 MB.

## 6. Correcciones de imágenes en 1.3.1

- Se normaliza el tipo MIME de los archivos usando también su extensión, para que las fotos seleccionadas desde Android no terminen tratadas como documentos genéricos.
- El selector multimedia intenta leer las rutas disponibles del proveedor de Android y reconoce los formatos habituales de imagen, vídeo y audio.
- Los mensajes identifican imágenes también por la extensión del archivo y muestran un enlace alternativo si la vista previa no puede cargarse.
- La actualización de la foto de perfil refresca el avatar y la lista de amigos; los avatares sin foto muestran una inicial.
- Se conserva la preparación web mediante la API de esbuild para evitar ejecutar el binario ELF como JavaScript en GitHub Actions.

## Notas

- El APK de este workflow es una compilación debug para pruebas, no una versión firmada de Play Store.
- Las conexiones en tiempo real usan Socket.IO; PeerJS no es necesario para mensajes. Puede añadirse luego para llamadas P2P.
- El almacenamiento local de mensajes es por dispositivo y por cuenta iniciada.
- `npm run build:web` ahora empaqueta el selector nativo de archivos; por eso ejecuta `npm install` antes de compilar y `npx cap sync android` después de cambiar dependencias.

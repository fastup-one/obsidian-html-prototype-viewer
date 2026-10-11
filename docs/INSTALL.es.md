# HTML Prototype Viewer (Strict) · Guía de instalación

*English version: `INSTALL.md`.*

Necesitas **Obsidian 1.13 o posterior** (Ajustes → Acerca de).

## Qué hay en el paquete

| Archivo | Para qué |
|---|---|
| `html-prototype-viewer-strict/` | El plugin: `main.js`, `manifest.json` y `styles.css`. Es lo que se instala. |
| `isolation-check.html` | Una página que dice sola si el aislamiento funciona (verde, ámbar o rojo). |
| `SHA256SUMS` | Las huellas de todos los archivos del paquete, por si quieres comprobarlas. |
| `INSTALL.md` / `INSTALL.es.md` / `INSTALL.html` | Esta guía. |

## 1. Instalar en el ordenador

1. Lleva el paquete al ordenador donde está tu Obsidian — descárgalo de la release de GitHub, o cópialo como prefieras
   (USB, nube, correo a ti mismo) — y descomprímelo.
2. En Obsidian, abre tu vault y ve a **Ajustes → Complementos comunitarios**.
3. Junto a «Complementos instalados», pulsa el **icono de la carpeta**: se abre la carpeta `plugins` de tu vault.
4. Copia dentro la carpeta **`html-prototype-viewer-strict`** del paquete (la carpeta entera).
5. Vuelve a Obsidian y pulsa el **icono de recargar** (la flecha circular) junto a «Complementos instalados».
6. Activa **HTML Prototype Viewer (Strict)**.
7. **Desactiva HTML Prototype Viewer** (el original). No lo borres: así puedes volver atrás cuando quieras.
8. Abre cualquier HTML de tu vault: encima de la página debe aparecer un escudo y la palabra **Aislado**.

## 2. Tus HTML de confianza

- Todo HTML se abre **aislado**: sin acceso a tu vault ni a internet. Para la mayoría basta.
- Si un HTML tuyo necesita recordar cosas (progreso, parámetros), usar internet o cargar archivos de su carpeta:
  ábrelo, pulsa el **escudo** de arriba y luego **Confiar**.
- Si ese archivo cambia (por ejemplo, lo regeneras), vuelve a aislado y te lo avisa. Si lo sigues queriendo así,
  vuelve a confiar.
- La lista de archivos de confianza, y los botones para retirarlos, están en **Ajustes → HTML Prototype Viewer
  (Strict)**.
- La confianza viaja con el vault: lo que confíes en el ordenador también será de confianza en el móvil.

## 3. En el móvil

El plugin llega al móvil con la sincronización de tu vault:

- **Obsidian Sync:** en los ajustes de Sync, activa que se sincronicen los complementos comunitarios instalados y la
  lista de complementos activos.
- **Otra sincronización** (iCloud, Syncthing, Git…): la carpeta oculta `.obsidian` viaja con el vault; no hay que hacer
  nada más.

Después, en el móvil: **Ajustes → Complementos comunitarios** → activa **HTML Prototype Viewer (Strict)** y desactiva
el original.

**La única comprobación que falta** (2 minutos):

1. Copia `isolation-check.html` a tu vault y ábrelo en el **móvil**. Debe salir **🟢 VERDE** (selector EN/ES arriba a
   la derecha).
2. Pulsa el escudo → **Confiar**. Dime si sale **🟠 ÁMBAR** o **🔴 ROJO**. Rojo significa que en el móvil un archivo
   de confianza puede ver tu vault: no es un fallo, pero hay que saberlo para decidir en qué confías.
3. Pulsa el escudo otra vez para retirar la confianza. Después puedes borrar el archivo.

## 4. Volver atrás

Desactiva **HTML Prototype Viewer (Strict)** y activa el original. Nada más.

## 5. Comprobar el paquete (opcional)

`SHA256SUMS` contiene la huella SHA-256 de cada archivo del paquete. En macOS, desde la Terminal, dentro de la carpeta
descomprimida: `shasum -a 256 -c SHA256SUMS` debe responder `OK` en cada línea.

Los paquetes que genera GitHub llevan además una atestación firmada de procedencia, que prueba que el zip se construyó
desde el repositorio con su workflow de release: `gh attestation verify <zip> --repo <propietario>/<repo>`.

## Qué hace, en resumen

- **Aislado** (siempre, salvo que confíes en el archivo): la página no puede tocar Obsidian ni tu vault, no tiene
  internet, no guarda datos, no abre ventanas, no muestra diálogos ni descarga archivos. Encima de la página se explica
  qué se ha bloqueado.
- **De confianza** (solo los archivos que tú elijas, y solo mientras no cambien): se ve como en el plugin original.
  Encima aparece **Sin aislamiento · archivo de confianza** en naranja.
- **Riesgo que queda:** una página puede intentar irse a otra web; esa petición sale. El plugin la detiene y muestra un
  aviso, salvo si lo hace mientras la página aún se está cargando.
- Lo que nunca debe pasar: una página en blanco sin explicación. Si la ves, avísame.

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
- Confiar en un archivo en el ordenador también lo aprueba para tu móvil (ver abajo); el móvil pregunta igualmente antes de confiar.

## 3. En el móvil

El plugin llega al móvil con la sincronización de tu vault; el explorador de archivos del móvil no ve la carpeta oculta
`.obsidian`, así que no hay nada que copiar a mano. Con **Self-hosted LiveSync**, usa su *Hidden File Sync* limitado a
la carpeta de este plugin:

1. En los ajustes de LiveSync: **General Settings → Extra menus** → activa **Enable advanced features** (solo ese).
2. **Selector → Hidden Files**: añade en **Target patterns**
   ```
   ^\.obsidian(?:$|/plugins(?:$|/html-prototype-viewer-strict(?:/|$)))
   ```
   y en **Ignore patterns**
   ```
   ^\.obsidian/plugins/html-prototype-viewer-strict/data\.json$
   ```
3. **Sync Settings → Hidden Files → Enable Hidden File Sync**: elige **Overwrite** en el ordenador y **Fetch** en el
   móvil. Reinicia Obsidian cuando te lo pida.
4. En el móvil: **Ajustes → Complementos comunitarios** → activa **HTML Prototype Viewer (Strict)** y desactiva el
   original.

Solo viajan los archivos de este plugin; sus ajustes y la lista de confianza propia del móvil (`data.json`) se quedan
en cada dispositivo.

### La confianza en el móvil necesita tu ordenador

En el móvil, un archivo de confianza obtiene **acceso completo a tu vault**: puede leer, cambiar y borrar tus notas y
enviarlas por internet. Por eso el móvil solo deja confiar en un archivo en el que **tu ordenador ya confió con
exactamente el mismo contenido**. Las aprobaciones del ordenador viajan en `approvals.json`, dentro de la carpeta del
plugin. En el móvil vuelves a confirmar, marcando una casilla, y el archivo lleva la etiqueta **Acceso completo al vault
· archivo de confianza**. Si el archivo cambia, o retiras la confianza en el ordenador, el móvil vuelve a mostrarlo
aislado (en 30 segundos). Retirarla en el ordenador también anula la confirmación del móvil: para volver a confiar allí,
confía en el ordenador y vuelve a confirmar en el móvil.

**Compruébalo** (2 minutos), con `isolation-check.html` en tu vault:

1. En el móvil: sale **🟢 VERDE**. Pulsa el escudo: un aviso te dice que primero confíes en él en tu ordenador.
2. En el ordenador: escudo → **Confiar**. Espera a la sincronización.
3. En el móvil: escudo → marca la casilla → **Confiar**. Sale **🔴 ROJO** con la etiqueta roja: es lo esperado, eso es
   el acceso completo.
4. En el ordenador: escudo otra vez (retirar). En 30 segundos el móvil vuelve a **🟢 VERDE**, con un aviso de que tu
   ordenador retiró su aprobación. Volver a confiar en el móvil exige otra vez los dos pasos.

### Actualizar

Sustituye los tres archivos de la carpeta del plugin en el ordenador por los de la versión nueva. La sincronización los
lleva al móvil. Después reinicia Obsidian en los dos dispositivos.

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
  Encima aparece **Sin aislamiento · archivo de confianza** en naranja en el ordenador; **Acceso completo al vault ·
  archivo de confianza** en rojo en el móvil, donde además necesita la aprobación de tu ordenador.
- **Riesgo que queda:** una página puede intentar irse a otra web; esa petición sale. El plugin la detiene y muestra un
  aviso, salvo si lo hace mientras la página aún se está cargando.
- Lo que nunca debe pasar: una página en blanco sin explicación. Si la ves, avísame.

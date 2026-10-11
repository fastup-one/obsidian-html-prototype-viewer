import { moment } from "obsidian";

/**
 * English is the source of truth: any key missing from another language falls
 * back to it. The language follows Obsidian's own, exposed as moment's locale.
 */
const EN = {
	"view.title": "HTML prototype",

	"action.reload": "Reload prototype",
	"action.viewport": "Render width",
	"action.openExternally": "Open in browser",
	"action.trust": "Isolated · trust this file…",
	"action.revoke": "Not isolated · revoke trust",

	"viewport.full": "Full width",
	"viewport.desktop": "Desktop — 1280 px",
	"viewport.tablet": "Tablet — 834 px",
	"viewport.mobile": "Mobile — 390 px",

	"command.reload": "Reload the displayed prototype",
	"command.openExternally": "Open the prototype in the browser",
	"command.insertEmbed": "Insert a prototype preview in the note",
	"command.trust": "Trust the displayed HTML file…",
	"command.revoke": "Revoke trust for the displayed HTML file",

	"status.isolated": "Isolated",
	"status.isolated.blocked":
		"This page has no access to Obsidian or your vault and no internet. It cannot store data (localStorage), open new windows, show alert/confirm/prompt dialogs or download files. Neighbouring files (CSS, images, other pages) do not load.",
	"status.isolated.residual":
		"Remaining risk: a page can still send itself to a website (one request leaves). The plugin stops it when it notices.",
	"status.isolated.howto": "If you trust this file, use the shield button at the top to show it without isolation.",
	"status.trusted": "Not isolated · trusted file",
	"status.trusted.details":
		"This file runs with the permissions of the original plugin: internet, storage, new windows and downloads and, on mobile, possibly access to your vault. If its content changes, it goes back to isolated automatically.",

	"notice.changed": "This file changed since you trusted it, so it is shown isolated.",
	"notice.relative": "{0} neighbouring file(s) will not load in isolated mode",
	"notice.remote": "{0} internet resource(s) blocked",
	"notice.features": "Does not work in isolated mode: {0}.",
	"feature.popups": "new windows",
	"feature.modals": "alert/confirm/prompt dialogs",
	"feature.downloads": "downloads",
	"notice.navigationCode": "This page contains code that can send it to another web page.",
	"notice.navigated": "The page tried to leave its own document and was stopped.",
	"notice.navigated.reload": "Reload",
	"notice.readError": "Could not read {0}: {1}",

	"trust.title": "Trust this HTML file?",
	"trust.file": "File",
	"trust.size": "Size",
	"trust.hash": "Fingerprint",
	"trust.intro": "If you trust it, this file is no longer isolated:",
	"trust.warning.scripts": "its scripts run with the same permissions as in the original plugin;",
	"trust.warning.network": "it can connect to the internet, open windows and download files;",
	"trust.warning.storage": "it can store data (localStorage) and load neighbouring files;",
	"trust.warning.mobile": "it also becomes approved for your phone, where — if you confirm there too — it gets full access to your vault;",
	"trust.warning.changes": "if its content changes, it goes back to isolated until you trust it again.",
	"trust.cancel": "Cancel",
	"trust.confirm": "Trust",
	"trust.changedMeanwhile": "The file changed while the dialog was open. Nothing was trusted; try again.",
	"trust.done": "{0} is trusted and shown without isolation.",
	"trust.revoked": "{0} is isolated again.",
	"trust.error": "Could not trust {0}: {1}",
	"action.trust.mobile": "Isolated · trust (needs your computer's approval)…",
	"status.trusted.mobile": "Full vault access · trusted file",
	"status.trusted.mobile.details":
		"On this device a trusted file can read, change and delete your notes and use the internet. It stays trusted only while your computer's approval of this exact content stands.",
	"notice.unapproved":
		"Trusted on this device, but your computer has not approved this exact content (or withdrew its approval), so it is shown isolated.",
	"trust.needsApproval":
		"Trust this file on your computer first, with this exact content. Then you can trust it here.",
	"trust.mobile.warning":
		"On this device, a trusted file gets FULL access to your vault: it can read, change and delete your notes and send them over the internet.",
	"trust.mobile.approvedOn": "Approved on your computer on {0}.",
	"trust.mobile.ack": "I understand that this file will have full access to my vault on this device.",
	"review.title": "What this file does (quick static check — not a guarantee)",
	"review.hostAccess": "Tries to reach the window around it (Obsidian). On a phone, trusting it gives it full access to your vault.",
	"review.obsidianApi": "Calls Obsidian's own API or loads modules.",
	"review.dynamicCode": "Builds and runs code at runtime (eval, Function).",
	"review.obfuscation": "Contains encoded or obfuscated content.",
	"review.storage": "Stores data in the browser (localStorage, IndexedDB).",
	"review.remote": "Refers to: {0}",
	"review.none": "No access to Obsidian, network, storage or dynamic code found.",

	"setting.viewport.name": "Default render width",
	"setting.viewport.desc":
		"Width applied when opening an HTML file. Can be changed on the fly from the tab toolbar.",
	"setting.autoReload.name": "Reload automatically",
	"setting.autoReload.desc": "Refresh the preview whenever the HTML file changes on disk.",
	"setting.embedHeight.name": "Preview height in notes",
	"setting.embedHeight.desc": "Height in pixels of an html-preview block that does not specify one.",
	"setting.isolation.name": "Isolation",
	"setting.isolation.desc":
		"Every HTML file opens isolated: no access to Obsidian or your vault, no internet. Only files you trust run without isolation, and only while their content stays the same. There is no switch to turn isolation off for everything.",
	"setting.trusted.heading": "Trusted files",
	"setting.trusted.empty": "No trusted files. Every HTML file opens isolated.",
	"setting.trusted.item": "Trusted on {0} · fingerprint {1} · {2}",
	"setting.trusted.status.checking": "checking…",
	"setting.trusted.status.valid": "unchanged",
	"setting.trusted.status.changed": "changed, shown isolated",
	"setting.trusted.status.missing": "file not found",
	"setting.trusted.revokeAll.name": "Revoke all",
	"setting.trusted.revokeAll.desc": "Shows every HTML file isolated again.",
	"setting.trusted.revokeAll.title": "Revoke trust for every file?",
	"setting.trusted.revokeAll.body": "{0} file(s) will be shown isolated again.",
	"setting.trusted.revokeAll.confirm": "Revoke all",

	"embed.button.browser": "Browser",
	"embed.button.tab": "Tab",
	"embed.error.noTarget":
		"No file specified. Expected a path, a [[link]] or `path: …`.",
	"embed.error.notFound": "File not found: {0}",
	"embed.error.notHtml": "{0} is not an HTML file.",
} as const;

export type TranslationKey = keyof typeof EN;

const FR: Partial<Record<TranslationKey, string>> = {
	"view.title": "Prototype HTML",

	"action.reload": "Recharger le prototype",
	"action.viewport": "Largeur de rendu",
	"action.openExternally": "Ouvrir dans le navigateur",
	"action.trust": "Isolé · faire confiance à ce fichier…",
	"action.revoke": "Non isolé · retirer la confiance",

	"viewport.full": "Pleine largeur",
	"viewport.desktop": "Desktop — 1280 px",
	"viewport.tablet": "Tablette — 834 px",
	"viewport.mobile": "Mobile — 390 px",

	"command.reload": "Recharger le prototype affiché",
	"command.openExternally": "Ouvrir le prototype dans le navigateur",
	"command.insertEmbed": "Insérer un aperçu de prototype dans la note",
	"command.trust": "Faire confiance au fichier HTML affiché…",
	"command.revoke": "Retirer la confiance au fichier HTML affiché",

	"status.isolated": "Isolé",
	"status.isolated.blocked":
		"Cette page n'a accès ni à Obsidian, ni à ton coffre, ni à internet. Elle ne peut pas stocker de données (localStorage), ouvrir de fenêtres, afficher de boîtes alert/confirm/prompt ni télécharger de fichiers. Les fichiers voisins (CSS, images, autres pages) ne se chargent pas.",
	"status.isolated.residual":
		"Risque restant : une page peut encore s'envoyer vers un site web (une requête part). Le plugin l'arrête dès qu'il le remarque.",
	"status.isolated.howto": "Si tu fais confiance à ce fichier, utilise le bouton bouclier en haut pour l'afficher sans isolation.",
	"status.trusted": "Non isolé · fichier de confiance",
	"status.trusted.details":
		"Ce fichier s'exécute avec les permissions du plugin d'origine : internet, stockage, nouvelles fenêtres et téléchargements et, sur mobile, peut-être l'accès à ton coffre. Si son contenu change, il redevient isolé automatiquement.",

	"notice.changed": "Ce fichier a changé depuis que tu lui as fait confiance : il est affiché isolé.",
	"notice.relative": "{0} fichier(s) voisin(s) ne se chargeront pas en mode isolé",
	"notice.remote": "{0} ressource(s) internet bloquée(s)",
	"notice.features": "Ne fonctionne pas en mode isolé : {0}.",
	"feature.popups": "nouvelles fenêtres",
	"feature.modals": "boîtes alert/confirm/prompt",
	"feature.downloads": "téléchargements",
	"notice.navigationCode": "Cette page contient du code qui peut l'envoyer vers une autre page web.",
	"notice.navigated": "La page a essayé de quitter son propre document et a été arrêtée.",
	"notice.navigated.reload": "Recharger",
	"notice.readError": "Impossible de lire {0} : {1}",

	"trust.title": "Faire confiance à ce fichier HTML ?",
	"trust.file": "Fichier",
	"trust.size": "Taille",
	"trust.hash": "Empreinte",
	"trust.intro": "Si tu lui fais confiance, ce fichier n'est plus isolé :",
	"trust.warning.scripts": "ses scripts s'exécutent avec les mêmes permissions que dans le plugin d'origine ;",
	"trust.warning.network": "il peut se connecter à internet, ouvrir des fenêtres et télécharger des fichiers ;",
	"trust.warning.storage": "il peut stocker des données (localStorage) et charger des fichiers voisins ;",
	"trust.warning.mobile": "il devient aussi approuvé pour ton téléphone, où — si tu confirmes là-bas aussi — il obtient un accès complet à ton coffre ;",
	"trust.warning.changes": "si son contenu change, il redevient isolé jusqu'à ce que tu lui refasses confiance.",
	"trust.cancel": "Annuler",
	"trust.confirm": "Faire confiance",
	"trust.changedMeanwhile": "Le fichier a changé pendant que la fenêtre était ouverte. Rien n'a été approuvé ; réessaie.",
	"trust.done": "{0} est de confiance et s'affiche sans isolation.",
	"trust.revoked": "{0} est de nouveau isolé.",
	"trust.error": "Impossible de faire confiance à {0} : {1}",
	"action.trust.mobile": "Isolé · faire confiance (nécessite l'approbation de ton ordinateur)…",
	"status.trusted.mobile": "Accès complet au coffre · fichier de confiance",
	"status.trusted.mobile.details":
		"Sur cet appareil, un fichier de confiance peut lire, modifier et supprimer tes notes et utiliser internet. Il ne reste de confiance que tant que ton ordinateur approuve ce contenu exact.",
	"notice.unapproved":
		"De confiance sur cet appareil, mais ton ordinateur n'a pas approuvé ce contenu exact (ou a retiré son approbation) : il est affiché isolé.",
	"trust.needsApproval":
		"Fais d'abord confiance à ce fichier sur ton ordinateur, avec ce contenu exact. Ensuite tu pourras lui faire confiance ici.",
	"trust.mobile.warning":
		"Sur cet appareil, un fichier de confiance obtient un accès COMPLET à ton coffre : il peut lire, modifier et supprimer tes notes et les envoyer sur internet.",
	"trust.mobile.approvedOn": "Approuvé sur ton ordinateur le {0}.",
	"trust.mobile.ack": "Je comprends que ce fichier aura un accès complet à mon coffre sur cet appareil.",
	"review.title": "Ce que fait ce fichier (vérification statique rapide — pas une garantie)",
	"review.hostAccess": "Essaie d'atteindre la fenêtre qui l'entoure (Obsidian). Sur un téléphone, lui faire confiance lui donne un accès complet à ton coffre.",
	"review.obsidianApi": "Appelle l'API d'Obsidian ou charge des modules.",
	"review.dynamicCode": "Construit et exécute du code à la volée (eval, Function).",
	"review.obfuscation": "Contient du contenu encodé ou obscurci.",
	"review.storage": "Stocke des données dans le navigateur (localStorage, IndexedDB).",
	"review.remote": "Fait référence à : {0}",
	"review.none": "Aucun accès à Obsidian, au réseau, au stockage ni de code dynamique trouvé.",

	"setting.viewport.name": "Largeur d'affichage par défaut",
	"setting.viewport.desc":
		"Largeur appliquée à l'ouverture d'un fichier HTML. Modifiable à la volée depuis la barre d'outils de l'onglet.",
	"setting.autoReload.name": "Recharger automatiquement",
	"setting.autoReload.desc": "Rafraîchit le rendu dès que le fichier HTML est modifié sur le disque.",
	"setting.embedHeight.name": "Hauteur des aperçus dans les notes",
	"setting.embedHeight.desc": "Hauteur en pixels d'un bloc html-preview qui n'en précise pas.",
	"setting.isolation.name": "Isolation",
	"setting.isolation.desc":
		"Chaque fichier HTML s'ouvre isolé : sans accès à Obsidian ni à ton coffre, sans internet. Seuls les fichiers auxquels tu fais confiance s'exécutent sans isolation, et seulement tant que leur contenu ne change pas. Il n'existe pas d'interrupteur pour tout désisoler.",
	"setting.trusted.heading": "Fichiers de confiance",
	"setting.trusted.empty": "Aucun fichier de confiance. Chaque fichier HTML s'ouvre isolé.",
	"setting.trusted.item": "Approuvé le {0} · empreinte {1} · {2}",
	"setting.trusted.status.checking": "vérification…",
	"setting.trusted.status.valid": "inchangé",
	"setting.trusted.status.changed": "modifié, affiché isolé",
	"setting.trusted.status.missing": "fichier introuvable",
	"setting.trusted.revokeAll.name": "Tout retirer",
	"setting.trusted.revokeAll.desc": "Affiche de nouveau chaque fichier HTML isolé.",
	"setting.trusted.revokeAll.title": "Retirer la confiance à tous les fichiers ?",
	"setting.trusted.revokeAll.body": "{0} fichier(s) seront de nouveau affichés isolés.",
	"setting.trusted.revokeAll.confirm": "Tout retirer",

	"embed.button.browser": "Navigateur",
	"embed.button.tab": "Onglet",
	"embed.error.noTarget":
		"Aucun fichier indiqué. Attendu : un chemin, un lien [[…]] ou `path: …`.",
	"embed.error.notFound": "Fichier introuvable : {0}",
	"embed.error.notHtml": "{0} n'est pas un fichier HTML.",
};

const ES: Partial<Record<TranslationKey, string>> = {
	"view.title": "Prototipo HTML",

	"action.reload": "Recargar el prototipo",
	"action.viewport": "Ancho de renderizado",
	"action.openExternally": "Abrir en el navegador",
	"action.trust": "Aislado · confiar en este archivo…",
	"action.revoke": "Sin aislamiento · retirar la confianza",

	"viewport.full": "Ancho completo",
	"viewport.desktop": "Escritorio — 1280 px",
	"viewport.tablet": "Tableta — 834 px",
	"viewport.mobile": "Móvil — 390 px",

	"command.reload": "Recargar el prototipo mostrado",
	"command.openExternally": "Abrir el prototipo en el navegador",
	"command.insertEmbed": "Insertar una vista previa de prototipo en la nota",
	"command.trust": "Confiar en el archivo HTML mostrado…",
	"command.revoke": "Retirar la confianza al archivo HTML mostrado",

	"status.isolated": "Aislado",
	"status.isolated.blocked":
		"Esta página no tiene acceso a Obsidian, a tu vault ni a internet. No puede guardar datos (localStorage), abrir ventanas nuevas, mostrar diálogos alert/confirm/prompt ni descargar archivos. Los archivos vecinos (CSS, imágenes, otras páginas) no se cargan.",
	"status.isolated.residual":
		"Riesgo que queda: una página aún puede mandarse a sí misma a una web (sale una petición). El plugin la detiene en cuanto lo nota.",
	"status.isolated.howto": "Si confías en este archivo, usa el botón del escudo de arriba para verlo sin aislamiento.",
	"status.trusted": "Sin aislamiento · archivo de confianza",
	"status.trusted.details":
		"Este archivo se ejecuta con los permisos del plugin original: internet, almacenamiento, ventanas nuevas y descargas y, en móvil, posiblemente acceso a tu vault. Si su contenido cambia, vuelve a aislado automáticamente.",

	"notice.changed": "Este archivo cambió desde que confiaste en él, así que se muestra aislado.",
	"notice.relative": "{0} archivo(s) vecino(s) no se cargarán en modo aislado",
	"notice.remote": "{0} recurso(s) de internet bloqueado(s)",
	"notice.features": "No funciona en modo aislado: {0}.",
	"feature.popups": "ventanas nuevas",
	"feature.modals": "diálogos alert/confirm/prompt",
	"feature.downloads": "descargas",
	"notice.navigationCode": "Esta página contiene código que puede mandarla a otra web.",
	"notice.navigated": "La página intentó salir de su propio documento y se ha detenido.",
	"notice.navigated.reload": "Volver a cargar",
	"notice.readError": "No se pudo leer {0}: {1}",

	"trust.title": "¿Confiar en este archivo HTML?",
	"trust.file": "Archivo",
	"trust.size": "Tamaño",
	"trust.hash": "Huella",
	"trust.intro": "Si confías en él, este archivo deja de estar aislado:",
	"trust.warning.scripts": "sus scripts se ejecutan con los mismos permisos que en el plugin original;",
	"trust.warning.network": "puede conectarse a internet, abrir ventanas y descargar archivos;",
	"trust.warning.storage": "puede guardar datos (localStorage) y cargar archivos vecinos;",
	"trust.warning.mobile": "también queda aprobado para tu móvil, donde — si lo confirmas también allí — obtiene acceso completo a tu vault;",
	"trust.warning.changes": "si su contenido cambia, vuelve a aislado hasta que vuelvas a confiar en él.",
	"trust.cancel": "Cancelar",
	"trust.confirm": "Confiar",
	"trust.changedMeanwhile": "El archivo cambió mientras el diálogo estaba abierto. No se ha confiado en nada; vuelve a intentarlo.",
	"trust.done": "{0} es de confianza y se muestra sin aislamiento.",
	"trust.revoked": "{0} vuelve a estar aislado.",
	"trust.error": "No se pudo confiar en {0}: {1}",
	"action.trust.mobile": "Aislado · confiar (requiere la aprobación de tu ordenador)…",
	"status.trusted.mobile": "Acceso completo al vault · archivo de confianza",
	"status.trusted.mobile.details":
		"En este dispositivo un archivo de confianza puede leer, cambiar y borrar tus notas y usar internet. Solo sigue siendo de confianza mientras tu ordenador mantenga la aprobación de este contenido exacto.",
	"notice.unapproved":
		"De confianza en este dispositivo, pero tu ordenador no ha aprobado este contenido exacto (o retiró su aprobación), así que se muestra aislado.",
	"trust.needsApproval":
		"Primero confía en este archivo en tu ordenador, con este contenido exacto. Después podrás confiar en él aquí.",
	"trust.mobile.warning":
		"En este dispositivo, un archivo de confianza obtiene acceso COMPLETO a tu vault: puede leer, cambiar y borrar tus notas y enviarlas por internet.",
	"trust.mobile.approvedOn": "Aprobado en tu ordenador el {0}.",
	"trust.mobile.ack": "Entiendo que este archivo tendrá acceso completo a mi vault en este dispositivo.",
	"review.title": "Qué hace este archivo (revisión estática rápida — no es una garantía)",
	"review.hostAccess": "Intenta llegar a la ventana que lo rodea (Obsidian). En un móvil, confiar en él le da acceso completo a tu vault.",
	"review.obsidianApi": "Llama a la API de Obsidian o carga módulos.",
	"review.dynamicCode": "Construye y ejecuta código sobre la marcha (eval, Function).",
	"review.obfuscation": "Contiene contenido codificado u ofuscado.",
	"review.storage": "Guarda datos en el navegador (localStorage, IndexedDB).",
	"review.remote": "Hace referencia a: {0}",
	"review.none": "No se ha encontrado acceso a Obsidian, red, almacenamiento ni código dinámico.",

	"setting.viewport.name": "Ancho de renderizado por defecto",
	"setting.viewport.desc":
		"Ancho aplicado al abrir un archivo HTML. Se puede cambiar en cualquier momento desde la barra de la pestaña.",
	"setting.autoReload.name": "Recargar automáticamente",
	"setting.autoReload.desc": "Actualiza la vista previa cuando el archivo HTML cambia en el disco.",
	"setting.embedHeight.name": "Altura de las vistas previas en notas",
	"setting.embedHeight.desc": "Altura en píxeles de un bloque html-preview que no indique una.",
	"setting.isolation.name": "Aislamiento",
	"setting.isolation.desc":
		"Todo archivo HTML se abre aislado: sin acceso a Obsidian ni a tu vault, sin internet. Solo los archivos en los que confías se ejecutan sin aislamiento, y solo mientras su contenido no cambie. No existe ningún interruptor para quitar el aislamiento a todo.",
	"setting.trusted.heading": "Archivos de confianza",
	"setting.trusted.empty": "No hay archivos de confianza. Todo archivo HTML se abre aislado.",
	"setting.trusted.item": "Confiado el {0} · huella {1} · {2}",
	"setting.trusted.status.checking": "comprobando…",
	"setting.trusted.status.valid": "sin cambios",
	"setting.trusted.status.changed": "cambiado, se muestra aislado",
	"setting.trusted.status.missing": "archivo no encontrado",
	"setting.trusted.revokeAll.name": "Retirar todos",
	"setting.trusted.revokeAll.desc": "Vuelve a mostrar aislado todo archivo HTML.",
	"setting.trusted.revokeAll.title": "¿Retirar la confianza a todos los archivos?",
	"setting.trusted.revokeAll.body": "{0} archivo(s) volverán a mostrarse aislados.",
	"setting.trusted.revokeAll.confirm": "Retirar todos",

	"embed.button.browser": "Navegador",
	"embed.button.tab": "Pestaña",
	"embed.error.noTarget":
		"No se ha indicado ningún archivo. Se espera una ruta, un enlace [[…]] o `path: …`.",
	"embed.error.notFound": "Archivo no encontrado: {0}",
	"embed.error.notHtml": "{0} no es un archivo HTML.",
};

function currentLanguage(): string {
	try {
		return moment.locale();
	} catch {
		return "en";
	}
}

/** Translates `key`, substituting `{0}`, `{1}`… with `params`. */
export function t(key: TranslationKey, ...params: string[]): string {
	const language = currentLanguage();
	const table = language.startsWith("fr") ? FR : language.startsWith("es") ? ES : undefined;
	const template = table?.[key] ?? EN[key];
	return params.reduce<string>(
		(acc, value, index) => acc.split(`{${index}}`).join(value),
		template,
	);
}

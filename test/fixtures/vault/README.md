# Test vault · HTML Prototype Viewer (Strict)

*Español más abajo.*

Open the files in order (left panel) and check that you see what each item says. If something does not match, report
the number and what you see (a screenshot is fine). Every page has an **EN / ES** switch at the top right.

Above every page there is a line with a shield and the word **Isolated**. That is the normal state.

1. **01-basic** → green screen with «✅ The HTML is shown».
2. **02-isolation** → **🟢 GREEN: properly isolated**.
3. **03-anchors** → click «Go to the end»: the page scrolls down to «✅ END». It never turns blank.
4. **04-external-resources** → **🟢 GREEN**. Above the page: «3 internet resource(s) blocked» and «2 neighbouring
   file(s) will not load».
5. **05-forms** → click both «Send» buttons: both results are **green**.
6. **06-leave-the-page** → click «Try to leave»: the page disappears and a notice says «The page tried to leave its own
   document and was stopped», with a «Reload» button.
7. **07-trust** → green band «🛡️ Isolated: this page cannot store anything». Then:
   1. Click the **shield** in the tab's top bar. A dialog asks whether you trust the file, with its path, size and
      fingerprint. Click **Trust**.
   2. The line at the top becomes **Not isolated · trusted file** (orange) and the band counts your visits. Reload
      (circular arrow): the number goes up.
   3. Click the shield again: back to **Isolated** at once, without a dialog.
8. **02-isolation** again, trusted this time (shield → Trust):
   - On the **computer**: **🟠 AMBER**.
   - On the **phone**: tell me whether it shows **🟠 AMBER** or **🔴 RED** (red means a trusted file can see your vault
     on mobile; not a bug, but worth knowing).
   - Then click the shield to revoke the trust.
9. **Note with preview** → open [[Note with preview]]: 02-isolation shows inside the note, **🟢 GREEN**, with the
   «Isolated» line above it.
10. **Settings** → Obsidian settings → *HTML Prototype Viewer (Strict)*: the isolation explanation and the «Trusted
    files» list (empty if you revoked everything).

What must **never** happen: a blank page with no explanation.

---

## Español

Abre los archivos en orden y comprueba que ves lo que dice cada punto. Si algo no coincide, dime el número y qué ves.
Cada página tiene un selector **EN / ES** arriba a la derecha.

1. **01-basic** → pantalla verde con «✅ Se ve el HTML».
2. **02-isolation** → **🟢 VERDE: aislado correctamente**.
3. **03-anchors** → pulsa «Ir al final»: baja hasta «✅ FIN»; nunca se queda en blanco.
4. **04-external-resources** → **🟢 VERDE**, y encima los avisos de 3 recursos de internet bloqueados y 2 archivos
   vecinos.
5. **05-forms** → los dos «Enviar» dan resultado **verde**.
6. **06-leave-the-page** → «Intentar salir»: la página desaparece y sale el aviso de que se ha detenido, con un botón
   para volver a cargar.
7. **07-trust** → escudo → **Confiar**: la línea pasa a «Sin aislamiento» (naranja) y el contador sube al recargar;
   escudo otra vez → vuelve a aislado sin preguntar.
8. **02-isolation** con confianza: **🟠 ÁMBAR** en el ordenador; en el móvil dime si sale ámbar o **🔴 ROJO**. Después
   retira la confianza.
9. [[Note with preview]] → la prueba se ve dentro de la nota en **🟢 VERDE**.
10. **Ajustes** → *HTML Prototype Viewer (Strict)*: explicación del aislamiento y lista de archivos de confianza.

Lo que no debe pasar nunca: una página en blanco sin explicación.

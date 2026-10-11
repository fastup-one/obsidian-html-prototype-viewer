# Vault de prueba · HTML Prototype Viewer (Strict)

Abre los archivos en orden (panel de la izquierda) y mira si sale lo que dice cada punto. Si algo no coincide, dime el
número y qué ves (una captura vale).

Arriba de cada página verás una línea con un escudo y la palabra **Aislado**. Es el estado normal.

1. **01-basico** → pantalla verde con «✅ Se ve el HTML».
2. **02-aislamiento** → banda **🟢 VERDE: aislado correctamente**.
3. **03-anclas** → pulsa «Ir al final»: la página baja hasta «✅ FIN». No se queda en blanco.
4. **04-recursos-externos** → banda **🟢 VERDE**. Encima de la página, avisos de «3 recursos de internet bloqueados» y
   «2 archivos vecinos no se cargarán».
5. **05-formulario** → pulsa los dos «Enviar»: los dos resultados salen en **verde**.
6. **06-salir-de-la-pagina** → pulsa «Intentar salir»: la página desaparece y sale el aviso «La página intentó salir
   de su propio documento y se ha detenido» con un botón «Volver a cargar».
7. **07-confianza** → banda verde «🛡️ Aislado: esta página no puede guardar nada». Ahora:
   1. Pulsa el **escudo** de la barra superior de la pestaña. Sale un aviso que pregunta si confías en el archivo, con
      su ruta, tamaño y huella. Pulsa **Confiar**.
   2. La línea de arriba cambia a **Sin aislamiento · archivo de confianza** (en naranja) y la banda dice cuántas veces
      has abierto la página. Recarga (flecha circular): el número sube.
   3. Vuelve a pulsar el escudo: vuelve a **Aislado** al instante, sin preguntar.
8. **02-aislamiento** otra vez, pero marcado como de confianza (escudo → Confiar):
   - En el **ordenador**: banda **🟠 ÁMBAR**.
   - En el **móvil**: dime si sale **🟠 ÁMBAR** o **🔴 ROJO** (rojo significa que en el móvil un archivo de confianza
     puede ver tu vault; no es un fallo, pero hay que saberlo).
   - Después, pulsa el escudo para retirarle la confianza.
9. **Nota con vista previa** → abre [[Nota con vista previa]]: dentro de la nota se ve 02-aislamiento en
   **🟢 VERDE**, con la línea «Aislado» encima.
10. **Ajustes** → Ajustes de Obsidian → *HTML Prototype Viewer (Strict)*: aparece la explicación del aislamiento y la
    lista «Archivos de confianza» (vacía si has retirado todo).

Lo que **no** debe pasar nunca: una página en blanco sin ninguna explicación.

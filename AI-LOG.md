# Bitácora de trabajo con IA

Herramienta: **Claude Code (Opus 5)**, usada de principio a fin del proyecto.

---

## Cómo trabajé con ella

Fijé cinco reglas antes de empezar, y las mantuve las dos jornadas:

- **Git es exclusivamente mío.** La IA no ejecuta `commit`, `add` ni `push`. Solo entrega el texto
  del mensaje, en Conventional Commits, sin firma ni coautoría.
- **Por fases, con validación entre una y la siguiente.** Nada avanza sin que yo revise lo anterior.
- **Archivos completos, nunca diffs.** Un diff aplicado a ciegas es código que no he leído.
- **El porqué se explica en el momento de escribirlo**, junto con la alternativa descartada.
- **Si una decisión mía tiene un problema real, se dice antes de implementarla**, no después.

La última regla es la que más rendimiento dio, y la tercera es la que sostiene el punto 2 del documento:
si el código llega en diffs, acabas con un repositorio que no puedes defender.

---

## Qué le pedí

Antes de escribir una línea, le pedí una **revisión crítica de las diez decisiones de arquitectura**
que ya había tomado. Mantuvo ocho y me hizo cambiar dos. Tres de esas correcciones eran fallos
reales de mi planteamiento que yo no había visto:

- **La cookie de sesión iba a ser de terceros.** El frontend vive en `*.amplifyapp.com` y la Lambda
  en `*.lambda-url.on.aws`: son sitios distintos, y Safari bloquea esas cookies por defecto. El
  login habría fallado en silencio en el navegador de quien evalúe. De ahí salió toda la estrategia
  de mismo origen, que es la decisión que más condiciona el proyecto.
- **Un índice secundario sobre el correo no garantiza unicidad.** Los GSI de DynamoDB no son únicos
  y comprobar antes de escribir tiene condición de carrera. El correo pasó a ser clave de partición.
- **`HeadObject` no verifica el tipo real de un archivo**, solo el que declaró quien lo subió. De
  ahí la verificación por *magic bytes* antes de registrar la solicitud.

Después le pedí la implementación por fases, y una cosa más que resultó ser la más útil de todas:
**verificar contra AWS de verdad, no contra la documentación.** Esa exigencia es la que destapó el
fallo que cuento abajo.

---

## Dónde su propuesta no funcionó

### Me recomendó algo que habría convertido mi cuenta en una de pago

Para configurar el acceso a AWS propuso **IAM Identity Center**, con seguridad y sin matices. IAM
Identity Center exige AWS Organizations, y unirse a Organizations **convierte la cuenta de Free Plan
a Paid Plan de forma irreversible**.

Lo detecté leyendo la documentación de facturación antes de ejecutarlo. Cambiamos a un usuario IAM
con claves y MFA, que era lo adecuado para una cuenta individual. Es el fallo más grave de los dos
días: una recomendación segura, plausible, y con consecuencias económicas que no mencionó.

### Diseñó el limitador de intentos sobre una premisa falsa

Al añadir el bloqueo por fuerza bruta, lo diseñó contando intentos **por IP**, y escribió en el
comentario del código que CloudFront añade la IP real del cliente al final de `X-Forwarded-For`, así
que bastaba con tomar el último valor.

Le exigí comprobarlo contra el despliegue, no darlo por bueno. Mandó una IP inventada con `curl` y
el contador empezó de cero: **Amplify reenvía esa cabecera tal y como llega y no añade nada**. El
límite entero se esquivaba cambiando un texto en la petición.

Lo rehicimos contando **por cuenta**, que es el dato que un atacante no puede falsear porque es
justo el que intenta forzar. Sin la verificación habríamos documentado como medida de seguridad algo
que se rompe con una línea de `curl`.

### Razonó sobre los requisitos de memoria en vez de leerlos

Repasando la cobertura funcional, me señaló que la tabla de solicitudes no permite reproducir el
vídeo y que eso podía incumplir el alcance. Le pasé el documento del cliente: el punto 3.3 pide
*"con su estado y fecha, puede ser una tabla simple"*. No había hueco.

Me habría hecho implementar reproducción de vídeo que nadie pidió. Desde ahí le exigí contrastar
contra el documento, no contra su recuerdo de él.

---

## Qué corregí o descarté, y por qué

**Un `package.json` en la raíz para compartir un solo paquete.** Para evitar duplicar los esquemas
de validación propuso npm workspaces, con su `package.json` y su `node_modules` en la raíz. Lo
descarté: montar esa maquinaria para tres archivos de esquemas y unas sesenta líneas era
desproporcionado. Preferí la duplicación consciente, documentada en el README con el motivo y con lo
que haría distinto en un equipo.

**Sobrecomplicó la lista negra de contraseñas.** Para que `Password1!` no pasara, propuso normalizar
la entrada deshaciendo sustituciones de tipo `0` por `o` y `@` por `a`, y recortar números del final,
antes de comparar. Le dije que las listas de contraseñas comunes salen de filtraciones reales y **ya
traen las variantes dentro**, porque hay gente que las usó. La solución era una comparación directa
contra una lista bien elegida. Quince líneas en lugar de una capa de transformaciones.

**Documentó de más.** En algún punto el `index.ts` tenía más comentario que código. Le corté la
densidad hasta dejar comentarios solo donde un lector se preguntaría *por qué*, no *qué*. Un
comentario que repite la línea de abajo es ruido que además envejece mal.

**Un reemplazo masivo me corrompió tablas.** Al sustituir un carácter en todo un documento de
trabajo, las celdas cuyo único contenido era ese carácter quedaron rotas. Desde ahí, cualquier
cambio en bloque se revisa por muestreo antes de darlo por bueno.

**Afirmaciones sobre hechos que no había comprobado.** Sostuvo que borrar el repositorio de GitHub
cambiaría el dominio de Amplify, cuando el dominio pertenece a la aplicación y no al repositorio. Y
exageró varias veces cuánto tiempo había costado una tarea. Ninguna de las dos cosas rompió nada,
pero las dos habrían acabado escritas en la documentación si no las contrasto.

---

## Criterio de uso

Con lo anterior sobre la mesa, el patrón se repite: **acierta con solvencia en lo que se puede
deducir del código, y falla en lo que solo se sabe mirando el sistema real o el documento original.**
Los tres fallos serios de estos dos días fueron ese tipo de fallo, y los tres se detectaron
comprobando en vez de leer.

De ahí las dos costumbres con las que trabajé:

**Todo lo verificable se verifica.** El límite de intentos se probó lanzando ataques reales contra
el despliegue. El bucket privado se comprobó pidiendo un vídeo sin firmar y viendo el 403. La
validación de servidor se comprobó saltándose el navegador con `curl`. Y el riesgo de Safari que
ella misma señaló, y que yo no podía reproducir desde Windows, acabé comprobándolo en un iPad:
inicié sesión, cerré la pestaña y al volver seguía dentro. Ninguna afirmación del README descansa
sobre la documentación de un servicio.

**Nada entra si no lo puedo explicar.** El punto 2 del documento dice que lo que se evalúa es si entiendo
y puedo defender cada decisión, no si escribí el código a mano. Por eso los archivos llegan
completos y no en diffs, por eso el porqué se escribe en el momento, y por eso cada línea de este
repositorio pasó por una lectura mía antes de un commit.

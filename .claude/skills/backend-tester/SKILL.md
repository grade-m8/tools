---
name: backend-tester
description: >-
  Use this skill to create, modify, and execute tests for the newly created or modified backend code
  in the current branch. It will automatically set up the testing infrastructure if it doesn't exist.
---

# Backend Tester Skill

Usa esta skill para escribir tests sobre el código en el que el desarrollador está trabajando.

## 1. Identificar el Código a Testear
A menos que el usuario te indique un archivo específico, tu objetivo es testear lo que se acaba de hacer en esta rama:
- Utiliza comandos de git (ej. `git status` o `git diff --name-status main...HEAD`) para identificar los archivos de lógica de negocio (Cloud Functions, Repositories, Services) que han sido creados o modificados recientemente.
- Enfoca la creación de tests exclusivamente en ese código nuevo o alterado.

## 2. Verificar y Preparar la Infraestructura
Antes de crear cualquier test, verifica si la infraestructura de testing (`setup.ts`, Docker de tests, Jest configurado) existe en el proyecto.
- **Si no existe o está incompleta:** DEBES detenerte y aplicar primero las reglas de la skill `backend-test-setup` para crear y validar el entorno. Una vez que el entorno esté en verde, puedes continuar.
- **Si ya existe:** Continúa directamente con la creación de los tests funcionales.

## 3. Tipos de Tests y Estructura de Carpetas
En backend aplican principalmente dos tipos de tests, que debes agrupar organizadamente en la carpeta `functions/test/` (fuera de `src/` para evitar que `tsc` los compile hacia `lib/` en producción):
-   **Tests Unitarios (Lógica pura / Utils):** Para lógica de negocio que no toca la base de datos. Guárdalos en `functions/test/unit/`. Mocks permitidos.
-   **Tests de Integración (Services / Repositories / Functions):** Para código que interactúa con Firestore o Auth. Usa los Emuladores locales (no mockees Firestore). Necesitan wrapping (`testEnv.wrap()`) para las Cloud Functions.
-   **Organización:** Agrupa los tests en subcarpetas ordenadas según su capa arquitectónica dentro de `functions/test/` (ej. `functions/test/controller/`, `functions/test/service/`, `functions/test/repository/`). Si la carpeta para el componente ya existe, guarda el test allí.

## 4. Aislamiento y Limpieza Global
-   **Aislamiento (`clearFirestore`):** Usa esta utilidad solo en tests de integración que modifiquen o lean Firestore.
-   **Limpieza Global:** No dupliques llamadas de limpieza (`cleanup`) si ya están en `functions/test/setup.ts`.

## 5. Roles y Creación de "Seeds" (Fixtures)
El sistema maneja tres tipos de usuarios clave: **Admin**, **Professor** y **Student**. 
-   **Cobertura Multi-Rol:** Cuando pruebes validaciones de acceso o flujos de información, asegúrate de escribir casos para los tres roles. Por ejemplo, validar que un *Admin* sí puede hacer algo que un *Student* tiene prohibido.
-   **Generación de Seeds:** Para no repetir código en cada test ensuciando el archivo, **debes crear funciones utilitarias o factorías** (ej. dentro de `functions/test/utils/`) que se encarguen de popular (seed) la base de datos de los emuladores con perfiles de estos roles, y con todos los elementos vinculados a ellos que la función necesite (materias, clases, exámenes, etc.). Si esos seeders ya existen, reutilízalos.

## 6. Comportamiento a Testear (Casos)
Asegúrate de cubrir los siguientes escenarios:
-   **Happy path:** Comportamiento esperado con datos válidos.
-   **Validaciones:** Faltan datos, formato incorrecto, duplicados.
-   **Autenticación y Roles:** Pruebas estrictas simulando las peticiones como Admin, Professor y Student.
-   **Casos Borde (Edge cases):** Arreglos vacíos, strings larguísimos, concurrencia (si aplica), o qué pasa cuando se busca un recurso que no existe.
-   **Errores Esperados:** Excepciones correctas cuando fallan las dependencias.

## 7. Ejecución y Errores (REGLAS DE ORO)
1.  Ejecuta los tests usando el comando oficial (`npm test`).
2.  Si el test falla por un error tuyo al escribirlo, **corrígelo**.
3.  **REGLA DE ORO:** Si descubres un bug real en el código de producción, **NUNCA alteres el código de producción silenciosamente**. Repórtalo. Nunca debilites un test (`it.skip`) para ocultar un bug.

## 8. Formato de Reporte (Para el Developer)
Al finalizar, SIEMPRE debes responder utilizando estrictamente este formato, incluyendo una guía paso a paso para que el developer pueda correr los tests:

```text
## Testing Completado

**Código analizado (cambios recientes):**
- [Lista de archivos revisados]

**Tests creados/modificados:**
- [Lista de archivos de test afectados]

**Casos cubiertos:**
- [Resumen de casos testeados, destacando los casos borde y roles probados]

**Resultado:**
✓ XX tests passed
✗ YY tests failed

**Problemas detectados:**
- [Bugs reales en producción, si los hubo]

---

### 🚀 Cómo correr estos tests tú mismo

Para levantar el entorno y correr la suite localmente, abre tu terminal y sigue estos pasos:

1. **Levantar los emuladores de Firebase:** Asegúrate de tener Docker corriendo, ve a la carpeta que contiene el docker-compose y levanta los servicios:
   `docker-compose up -d emulators`
2. **Ejecutar los tests:** En otra terminal, muévete a la carpeta del backend y corre Jest:
   `cd backend/functions`
   `npm test`
3. **Interpretar Resultados:**
   - Jest te mostrará un resumen verde si todo pasó (✓) o rojo si algo falló (✗).
   - Si algo falla, el mensaje de Jest te indicará exactamente qué aserción no se cumplió y en qué línea del archivo `.test.ts`.
   - Recuerda que puedes usar `npm run test:watch` para que los tests se re-ejecuten automáticamente cada vez que guardas un cambio.
```

---
name: backend-tester
description: >-
  Use this skill to create, modify, and execute tests for backend code in the current branch,
  respecting the project's dependency-injection architecture, folder hierarchy, and Jest mocks without using Docker.
---

# Backend Tester Skill

Usa esta skill para escribir y ejecutar tests sobre el código del backend (`backend/functions/`).

## 1. Identificar el Código a Testear
A menos que el usuario te indique un archivo específico, tu objetivo es testear lo que se acaba de implementar o modificar en la rama:
- Utiliza comandos de git (ej. `git status` o `git diff --name-status main...HEAD`) para identificar los archivos nuevos o modificados (Services, Middlewares, Controllers, Repositories).
- **Auditoría de Cobertura Honesta:** No omitas controladores de lectura ni conversores bajo la premisa de que "tienen pocas líneas". Todo archivo de lógica incluido en `collectCoverageFrom` debe tener su correspondiente test.

## 2. Verificar la Infraestructura de Testing
Antes de crear cualquier test, verifica que Jest esté operativo:
- Ejecuta `npm test` desde la raíz de `backend` (o dentro de `backend/functions`).
- Si la suite responde correctamente (ej. el `sanity.test.ts` y tests unitarios existentes pasan), continúa con la creación de tests.
- **PROHIBIDO CREAR `setup.ts` GLOBAL:** NO crees archivos `setup.ts` globales en la raíz de test. Los tests unitarios no interactúan con el SDK real de Firebase; las dependencias externas se simulan exclusivamente con los mocks tipados de `functions/test/mock/`. Jest no usa ningún archivo setup global en este repositorio.
- **PROHIBIDO EL USO DE DOCKER PARA TESTING:** No uses `docker compose up` ni intentes crear Dockerfiles de tests. Docker está reservado exclusivamente para desarrollo local. Para tests con emuladores, se usa únicamente `firebase emulators:exec`.

## 3. Arquitectura del Backend y Estructura de Tests

### Arquitectura de Código (`functions/src/`):
- **Capas:** `routes` → `controllers` → `services` → `repositories`.
- **Inyección de Dependencias (DI):** Los servicios (`src/service/<dominio>/`) no interactúan directamente con Firestore ni con Firebase Auth; en su lugar, reciben interfaces tipadas definidas en `src/types/<dominio>/` (ej: `UserRepository`, `AuthService`, `SubjectRepository`) inyectadas en su constructor (`src/di/container.ts`).
- **Controladores (`src/controller/`):** Reciben `req: Request` y `res: Response`, validan que `req.user` exista (o devuelven 401), validan el body/params y llaman al servicio mapeando errores de dominio con `mapAndReturnDomainError`.
- **Data Converters (`src/repository/*/*DataConverter.ts`):** Transforman datos entre el dominio y Firestore (`toFirestore` y `fromFirestore`). Son funciones puras y deben ser testeadas unitariamente al 100%.
- **Implementaciones de Firestore (`src/repository/**/firestore*Repo.ts`):** Clases que llaman directamente al SDK de Google (`getFirestore()`). Pertenecen a pruebas de integración.

### Jerarquía de Pruebas (`functions/test/` fuera de `src/`):
- **`functions/test/unit/`**: Pruebas unitarias en memoria (`*.test.ts`). Aquí se testea la lógica de negocio de servicios, controladores, middlewares y conversores con mocks tipados. Corren rápido y sin dependencias externas.
- **`functions/test/mock/`**: Factorías de mocks para interfaces de repositorios (`MockUserRepository.ts`, `MockSubjectRepository.ts`, etc.) y helpers para mockear `Request` y `Response` de Express.
- **`functions/test/integration/`**: Pruebas de integración reales contra Firebase Emulators para las clases `firestore*Repo.ts`. Se ejecutan **exclusivamente con `firebase emulators:exec`** vía `npm run test:emulators`.

## 4. Patrón de Implementación de Tests

### A. Para Servicios (Unitarios):
1. Reutilizar o crear el Mock en `functions/test/mock/Mock<Interface>.ts` con tipado estricto `jest.Mocked<Interface>`.
2. En el test (`functions/test/unit/<service>.test.ts`), instanciar el servicio inyectándole los mocks creados con `makeMock<...>()`.
3. Limpiar y restaurar con `beforeEach` (reinicializando mocks) y `afterEach(() => jest.restoreAllMocks())`.

### B. Para Controladores (Handlers de Express):
1. Mockear `req` con los datos necesarios (`req.user`, `req.body`, `req.params`, `req.query`).
2. Mockear `res` con espías de Jest:
   ```typescript
   const mockResponse = () => {
     const res: any = {};
     res.status = jest.fn().mockReturnValue(res);
     res.json = jest.fn().mockReturnValue(res);
     return res;
   };
   ```
3. Testear rechazo 401 si falta `req.user`, rechazo 400 si faltan campos obligatorios, y respuesta 200/201 con el JSON devuelto.

### C. Para Firestore Data Converters:
- Probar que `toFirestore()` mapee correctamente los campos (omitiendo IDs autogenerados y convirtiendo opcionales en `null`).
- Probar que `fromFirestore()` reconstruya la entidad tipada completa a partir de un mock de `QueryDocumentSnapshot` (`snapshot.id` y `snapshot.data()`).

### D. Para Repositorios de Firestore (Integración en `test/integration/`):
- Inicializar Firebase en el scope local del archivo conectándolo al emulador:
  ```typescript
  import { initializeApp, getApps } from 'firebase-admin/app';
  
  beforeAll(() => {
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    if (getApps().length === 0) {
      initializeApp({ projectId: 'demo-grade-m8' });
    }
  });
  ```
- Probar las operaciones reales `create`, `findById`, `listByTeacher`, etc., limpiando los documentos creados al terminar.

## 5. Roles y Fixtures

El sistema define roles de usuario (`UserRole`) en `src/types/user/userRole.ts`: `'Admin'`, `'Professor'`, y `'Student'`.
- **Pruebas de Autorización:** Cuando pruebes middlewares de autenticación/permisos (`src/middleware/auth.ts`) o lógica dependiente de roles, incluye casos para los tres roles.
- **Fixtures:** Define DTOs tipados (ej. `CreateUserDto`, `CreateSubjectDto`) como constantes en el archivo de test o como fixtures reutilizables.

## 6. Ejecución y Reglas de Oro
1. **Ejecuta los tests:**
   - Para tests unitarios rápidos: `npm test`
   - Para suite completa con emuladores efímeros: `npm run test:emulators`
   - Para ver cobertura: `npm run test:coverage`
2. Si un test falla por un error en su implementación o aserción, **corrígelo**.
3. **REGLA DE ORO:** Si descubres un bug real en el código de producción, **NUNCA alteres el código de producción silenciosamente**. Repórtalo con claridad en tu resumen. Nunca desactives un test (`it.skip` o `xit`) para enmascarar un bug.

## 7. Formato de Reporte (Para el Developer)
Al finalizar, responde utilizando estrictamente este formato:

```text
## Testing Completado

**Código analizado (cambios recientes):**
- [Lista de archivos revisados]

**Tests creados/modificados:**
- [Lista de archivos de test y mocks afectados]

**Casos cubiertos:**
- [Resumen de casos testeados, roles y casos borde]

**Resultado:**
✓ XX tests passed
✗ YY tests failed

**Problemas detectados:**
- [Bugs reales en producción, si los hubo]

---

### 🚀 Cómo correr estos tests tú mismo

Para ejecutar la suite localmente desde tu terminal:

1. **Ejecutar tests unitarios (rápidos en memoria):**
   `npm test` (desde la raíz de `backend/`)

2. **Ejecutar tests con emuladores efímeros (sin Docker, con firebase-tools):**
   `npm run test:emulators` (desde la raíz de `backend/`)

3. **Verificar cobertura:**
   `cd functions && npm run test:coverage`
```

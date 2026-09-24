---
name: backend-tester
description: >-
  Use this skill to create, modify, and execute tests for backend code in the current branch,
  respecting the project's dependency-injection architecture, folder hierarchy, and Jest mocks.
---

# Backend Tester Skill

Usa esta skill para escribir y ejecutar tests sobre el código del backend (`backend/functions/`).

## 1. Identificar el Código a Testear
A menos que el usuario te indique un archivo específico, tu objetivo es testear lo que se acaba de implementar o modificar en la rama:
- Utiliza comandos de git (ej. `git status` o `git diff --name-status main...HEAD`) para identificar los archivos nuevos o modificados (Services, Middlewares, Controllers, Repositories).
- Enfoca la creación de tests exclusivamente en ese código.

## 2. Verificar la Infraestructura de Testing
Antes de crear cualquier test, verifica que Jest esté operativo:
- Ejecuta `npm test` desde la raíz de `backend` (o dentro de `backend/functions`).
- Si la suite responde correctamente (ej. el `sanity.test.ts` y tests unitarios existentes pasan), continúa con la creación de tests.
- **Importante:** NO busques ni intentes crear `setup.ts`, `clearFirestore()`, ni un Dockerfile o Docker Compose secundario de tests. El backend ya tiene su entorno configurado y funcional. Si falta configuración base en Jest, recurre a `backend-test-setup`.

## 3. Arquitectura del Backend y Estructura de Tests

### Arquitectura de Código (`functions/src/`):
- **Capas:** `routes` → `controllers` → `services` → `repositories`.
- **Inyección de Dependencias (DI):** Los servicios (`src/service/<dominio>/`) no interactúan directamente con Firestore ni con Firebase Auth; en su lugar, reciben interfaces tipadas definidas en `src/types/<dominio>/` (ej: `UserRepository`, `AuthService`, `SubjectRepository`) inyectadas en su constructor (`src/di/container.ts`).
- **Validaciones:** Se realizan en los controladores a través de esquemas o en middlewares (`src/middleware/`).

### Jerarquía de Pruebas (`functions/test/` fuera de `src/`):
Los tests se ubican obligatoriamente fuera de `src/` para evitar que `tsc` los compile hacia `lib/`:
- **`functions/test/unit/`**: Contiene las suites de pruebas unitarias (`*.test.ts`). Aquí se testea la lógica de negocio de los servicios, validaciones y middlewares de forma rápida y aislada.
- **`functions/test/mock/`**: Contiene las factorías de mocks para las interfaces de repositorios y servicios externos (`MockUserRepository.ts`, `MockAuthService.ts`, etc.).
- **`functions/test/integration/`**: Reservado exclusivamente para pruebas de integración contra los emuladores locales de Firebase si son requeridas explícitamente. (La convención por defecto del proyecto prioriza pruebas unitarias con mocks tipados).

## 4. Patrón de Mocking y Aislamiento en Pruebas Unitarias

Para testear un servicio (ejemplo `UserService` o `SubjectService`):
1. **Reutilizar o crear el Mock del Repositorio/Servicio:**
   - En `functions/test/mock/Mock<Interface>.ts`, exporta una función constructora con mocks de Jest tipados:
     ```typescript
     import type UserRepository from '../../src/types/user/userRepo';

     export const makeMockUserRepository = (): jest.Mocked<UserRepository> => ({
       getUserById: jest.fn(),
       getAllByInstitution: jest.fn(),
       getUserByEmail: jest.fn(),
       createUser: jest.fn(),
     });
     ```
2. **Instanciar el Servicio en el Test:**
   - En `functions/test/unit/<service>.test.ts`, instancia el servicio inyectándole los mocks creados:
     ```typescript
     let userRepo: jest.Mocked<UserRepository>;
     let authService: jest.Mocked<AuthService>;
     let userService: UserService;

     beforeEach(() => {
       userRepo = makeMockUserRepository();
       authService = makeMockAuthService();
       userService = new UserService(userRepo, authService);
     });

     afterEach(() => {
       jest.restoreAllMocks();
     });
     ```
3. **Aislamiento:** No se necesita emulador ni `clearFirestore()` para los tests unitarios. Cada test configura el comportamiento de sus mocks con `mockResolvedValue`, `mockRejectedValue`, etc., y se asegura la limpieza con `jest.restoreAllMocks()` en `afterEach`.

## 5. Roles y Fixtures

El sistema define roles de usuario (`UserRole`) en `src/types/user/userRole.ts`: `'Admin'`, `'Professor'`, y `'Student'`.
- **Pruebas de Autorización:** Cuando pruebes middlewares de autenticación/permisos (`src/middleware/auth.ts`) o lógica dependiente de roles, incluye casos para los tres roles.
- **Fixtures:** Define DTOs tipados (ej. `CreateUserDto`) como constantes en el archivo de test o como fixtures reutilizables para mantener las aserciones legibles.

## 6. Casos a Cubrir
- **Happy path:** Flujo esperado con datos válidos y retornos correctos.
- **Validaciones y Errores de Negocio:** Validación de entradas, recursos inexistentes (`undefined` o excepciones controladas).
- **Mapeo de Errores:** Verificar que las fallas de repositorios o servicios dependientes se propaguen o transformen según lo esperado.
- **Casos Borde (Edge cases):** Arreglos vacíos, strings vacíos o límites numéricos.

## 7. Ejecución y Reglas de Oro
1. **Ejecuta los tests:**
   - Desde la raíz del backend: `npm test`
   - O desde `functions/`: `npm test`
2. Si un test falla por un error en su implementación o aserción, **corrígelo**.
3. **REGLA DE ORO:** Si descubres un bug real en el código de producción, **NUNCA alteres el código de producción silenciosamente**. Repórtalo con claridad en tu resumen. Nunca desactives un test (`it.skip` o `xit`) para enmascarar un bug.

## 8. Formato de Reporte (Para el Developer)
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

1. **Ejecutar todos los tests:**
   `npm test` (desde la raíz de `backend/` o dentro de `backend/functions/`)

2. **Ejecutar en modo interactivo (Watch):**
   `cd functions && npm run test:watch`

3. **Verificar cobertura:**
   `cd functions && npm run test:coverage`

*(Nota: Los tests unitarios utilizan mocks tipados y no requieren tener Docker ni los emuladores de Firebase encendidos. Si necesitas levantar los emuladores para desarrollo general o pruebas manuales, hazlo con `npm run docker:up` desde la raíz de `backend`).*
```

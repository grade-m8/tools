---
name: backend-test-setup
description: >-
  Use this skill to set up, configure, and validate the testing infrastructure for the backend.
  It verifies Jest configuration, collectCoverageFrom rules, TypeScript test settings, and emulator execution scripts without Docker.
---

# Backend Test Setup Skill

Usa esta skill exclusivamente para verificar, preparar o reparar la infraestructura de testing del backend. No uses esta skill para escribir tests funcionales sobre la lógica de negocio; para eso, usa `backend-tester`.

## 1. Verificar Infraestructura Existente

Antes de crear o modificar cualquier archivo, analiza el repositorio `backend` para determinar el estado actual de la infraestructura:
- **Si la infraestructura existe y es funcional:** No la recrees, modifiques ni dupliques. En `backend/functions`, la infraestructura ya se encuentra configurada y operativa.
- **Si falta algún componente específico:** Completa únicamente lo que falte, respetando estrictamente la arquitectura existente:
  - Dependencias de testing en `backend/functions/package.json` (`jest`, `ts-jest`, `@types/jest`, `firebase-functions-test`).
  - Configuración de Jest en `backend/functions/jest.config.cjs`:
    - `preset: 'ts-jest'`
    - `testMatch: ['**/test/**/*.test.ts']`
    - `maxWorkers: 1`
    - `collectCoverageFrom` auditando todo `src/**/*.ts` (excluyendo solo `index.ts`, `scripts/**`, `types/**`, y `*.d.ts`).
  - Configuración de TypeScript en `backend/functions/tsconfig.test.json` (extendiendo `./tsconfig.json` con `include: ["src", "test"]` y `types: ["jest", "node"]`).
  - Scripts en `backend/package.json`:
    - `"test": "npm --prefix functions run test"`
    - `"test:emulators": "firebase emulators:exec --only firestore,auth --project demo-grade-m8 \"npm test\""`
  - Scripts en `backend/functions/package.json`:
    - `"test": "jest"`, `"test:watch": "jest --watch"`, `"test:coverage": "jest --coverage"`.
  - Estructura de carpetas dentro de `backend/functions/test/`:
    - `functions/test/unit/` para pruebas unitarias en memoria (Services, Controllers, Converters, Middlewares).
    - `functions/test/mock/` para factorías de mocks tipados (`MockUserRepository.ts`, `MockAuthService.ts`, etc.).
    - `functions/test/integration/` para pruebas de integración reales contra emuladores de Firebase (`firestore*Repo.test.ts`).

### ⚠️ Reglas Críticas (Lo que NO debes hacer)
1. **PROHIBIDO EL USO DE DOCKER PARA TESTS:**
   - Docker (`docker-compose.yml`) está reservado **única y exclusivamente para desarrollo local**, ya que monta un volumen persistente (`emulator-data`) que se corrompería con datos de prueba.
   - **NUNCA** crees un segundo Docker Compose (`docker-compose.test.yml`) ni un `Dockerfile.test`.
   - Toda prueba que requiera emuladores de Firebase se ejecuta **exclusivamente mediante `firebase emulators:exec`** (`npm run test:emulators`), levantando emuladores efímeros limpios en RAM sin persistencia.
2. **PROHIBIDO CREAR O BUSCAR `setup.ts` GLOBAL (ni inicializaciones globales de Firebase en la raíz de test)**: Jest **NO** utiliza ningún archivo `setup.ts` global (no existe `setupFilesAfterEnv` en `jest.config.cjs`). Los tests unitarios corren directamente en memoria inyectando los mocks tipados de `functions/test/mock/`. Solo los archivos dentro de `functions/test/integration/` inicializan la conexión local en su propio scope.
3. **NO colocar carpetas de test dentro de `functions/src/`**. La compilación de TypeScript (`tsc`) emite código hacia `functions/lib/` tomando `functions/src/` como raíz; los tests deben residir siempre en `functions/test/`.
4. **PROHIBIDO HARDCODEAR RUTAS DEL SISTEMA O SINTAXIS ESPECÍFICA DE UN OS EN `package.json`**:
   - Los scripts de `package.json` deben ser **100% agnósticos y portables** (compatibles con Linux/GitHub Actions, macOS y Windows).
   - **NUNCA** incluyas rutas absolutas de una máquina específica (`C:\Users\...`, `/home/...`).
   - **NUNCA** utilices comandos dependientes de un shell específico como `set PATH=... &&` o `export PATH=...`.
   - Java es un requisito del entorno del sistema para los emuladores de Firebase. Si Java no está en el PATH, debe resolverse a nivel del sistema operativo (`PATH`/`JAVA_HOME`) o indicarlo al usuario, **nunca** ensuciando los scripts de `package.json`.

## 2. Pasos para Crear o Reparar Infraestructura (Solo si no existe)

1. Instalar dependencias de Jest y TypeScript en `functions/package.json`:
   - `jest`, `ts-jest`, `@types/jest`, `firebase-functions-test`.
2. Configurar `functions/jest.config.cjs`:
   ```javascript
   /** @type {import('ts-jest').JestConfigWithTsJest} */
   module.exports = {
     preset: 'ts-jest',
     testEnvironment: 'node',
     testMatch: ['**/test/**/*.test.ts'],
     maxWorkers: 1,
     transform: {
       '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
     },
     collectCoverageFrom: [
       'src/**/*.ts',
       '!src/index.ts',     // Entrada de Cloud Functions
       '!src/scripts/**',   // Scripts de mantenimiento local
       '!src/**/*.d.ts',
       '!src/types/**',     // Interfaces y contratos de tipos puros
     ],
   };
   ```
3. Configurar `functions/tsconfig.test.json`:
   ```json
   {
     "extends": "./tsconfig.json",
     "compilerOptions": {
       "rootDir": ".",
       "isolatedModules": true,
       "noEmit": true,
       "types": ["jest", "node"]
     },
     "include": ["src", "test"]
   }
   ```
4. Configurar scripts en `backend/package.json`:
   - `"test": "npm --prefix functions run test"`
   - `"test:emulators": "firebase emulators:exec --only firestore,auth --project demo-grade-m8 \"npm test\""`
5. Crear estructura de carpetas:
   - `functions/test/unit/`
   - `functions/test/mock/`
   - `functions/test/integration/`

## 3. Reglas Arquitectónicas Estrictas

- **Framework:** Usa Jest con `ts-jest`.
- **Concurrencia:** Mantén `maxWorkers: 1` en `jest.config.cjs`.
- **Estructura:** Tests siempre en `functions/test/` (fuera de `src/`).
- **Emuladores:** Ejecución efímera limpia vía `firebase emulators:exec`. Cero Docker para testing.

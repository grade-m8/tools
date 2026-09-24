---
name: backend-test-setup
description: >-
  Use this skill to set up, configure, and validate the testing infrastructure for the backend.
  It verifies Jest configuration, TypeScript test settings, and existing test directories without altering established conventions.
---

# Backend Test Setup Skill

Usa esta skill exclusivamente para verificar, preparar o reparar la infraestructura de testing del backend. No uses esta skill para escribir tests funcionales sobre la lógica de negocio; para eso, usa `backend-tester`.

## 1. Verificar Infraestructura Existente

Antes de crear o modificar cualquier archivo, analiza el repositorio `backend` para determinar el estado actual de la infraestructura:
- **Si la infraestructura existe y es funcional:** No la recrees, modifiques ni dupliques. En `backend/functions`, la infraestructura ya se encuentra configurada y operativa.
- **Si falta algún componente específico:** Completa únicamente lo que falte, respetando estrictamente la arquitectura existente:
  - Dependencias de testing en `backend/functions/package.json` (`jest`, `ts-jest`, `@types/jest`, `firebase-functions-test`).
  - Configuración de Jest en `backend/functions/jest.config.cjs` (con `preset: 'ts-jest'`, `testMatch: ['**/test/**/*.test.ts']`, `maxWorkers: 1`, y transform apuntando a `tsconfig.test.json`).
  - Configuración de TypeScript en `backend/functions/tsconfig.test.json` (extendiendo `./tsconfig.json` con `include: ["src", "test"]` y `types: ["jest", "node"]`).
  - Script en `backend/package.json`: `"test": "npm --prefix functions run test"`.
  - Scripts en `backend/functions/package.json`: `"test": "jest"`, `"test:watch": "jest --watch"`, `"test:coverage": "jest --coverage"`.
  - Estructura de carpetas dentro de `backend/functions/test/`:
    - `functions/test/unit/` para pruebas unitarias.
    - `functions/test/mock/` para factorías de mocks tipados (`MockUserRepository.ts`, `MockAuthService.ts`, etc.).
    - `functions/test/unit/sanity.test.ts` como test de validación básica.

### ⚠️ Reglas Críticas (Lo que NO debes hacer)
1. **NO buscar ni crear un segundo Docker Compose ni Dockerfile de tests** (como `docker-compose.test.yml` o `Dockerfile.test`). El proyecto usa un único `docker-compose.yml` en la raíz de `backend/` para los emuladores locales (`npm run docker:up`). La suite de tests se ejecuta directamente con Jest vía `npm test`.
2. **PROHIBIDO CREAR O BUSCAR `setup.ts` (ni inicializaciones globales con `initializeApp`, `getApps`, etc.)**: Jest **NO** utiliza ningún archivo `setup.ts` (no existe `setupFilesAfterEnv` en `jest.config.cjs`). Los tests unitarios corren directamente en memoria inyectando los mocks tipados de `functions/test/mock/`. Crear un `setup.ts` con `initializeApp` es código muerto/innecesario en este repositorio. Tampoco intentes modificar `jest.config.cjs` para forzar la carga de un archivo setup.
3. **NO colocar carpetas de test dentro de `functions/src/`**. La compilación de TypeScript (`tsc`) emite código hacia `functions/lib/` tomando `functions/src/` como raíz; los tests deben residir siempre en `functions/test/` para no contaminar el build productivo.

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
4. Crear la estructura de carpetas en `backend/functions/test/`:
   - `functions/test/unit/`
   - `functions/test/mock/`
5. Configurar los scripts en los `package.json`:
   - En `backend/package.json`: `"test": "npm --prefix functions run test"`
   - En `backend/functions/package.json`: `"test": "jest"`, `"test:watch": "jest --watch"`, `"test:coverage": "jest --coverage"`
6. Crear o verificar el sanity check (`functions/test/unit/sanity.test.ts`) y ejecutar `npm test` para confirmar que el entorno responda con éxito.

## 3. Reglas Arquitectónicas Estrictas

- **Framework:** Usa Jest con `ts-jest`. No uses Vitest ni Mocha.
- **Concurrencia:** Mantén `maxWorkers: 1` en `jest.config.cjs`.
- **Estructura:** Tests siempre en `functions/test/` (fuera de `src/`).
- **Mocks vs Emuladores:** Los servicios se prueban de manera unitaria con mocks tipados de Jest en `functions/test/mock/`. El único Docker Compose del proyecto (`backend/docker-compose.yml`) es para desarrollo local general de los emuladores, no un contenedor aislado de tests.

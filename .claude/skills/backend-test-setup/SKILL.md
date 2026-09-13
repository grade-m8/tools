---
name: backend-test-setup
description: >-
  Use this skill to set up, configure, and validate the testing infrastructure for the backend.
  It handles Jest installation, Docker configurations, Firebase Emulator setups, and test utilities.
---

# Backend Test Setup Skill

Use this skill exclusivamente para preparar o arreglar el entorno de testing del backend. No uses esta skill para escribir tests funcionales sobre la lógica de negocio; para eso, usa `backend-tester`.

## 1. Verificar Infraestructura Existente

Antes de crear cualquier archivo, analiza el repositorio para determinar el estado actual de la infraestructura:
-   **Si la infraestructura existe:** No la recrees ni dupliques. Analiza si funciona y úsala.
-   **Si la infraestructura existe parcialmente:** Completa únicamente los componentes que falten, respetando la arquitectura establecida.
    -   Si Jest está instalado pero falta configuración, configúralo.
    -   Si falta `setup.ts`, créalo.
    -   Si faltan utilidades como `clearFirestore()` en `functions/src/test/utils/emulatorTools.ts`, impleméntalas.
    -   Si falta el entorno Dockerizado (`Dockerfile.test` o `docker-compose.test.yml`), créalo.
-   **Si no existe infraestructura:** Créala desde cero siguiendo la arquitectura objetivo.

## 2. Pasos para Crear Infraestructura

Cuando debas crear la infraestructura desde cero o completar partes:
1.  Instala Jest y las dependencias de TypeScript (`ts-jest`, `@types/jest`).
2.  Configura Jest.
3.  Crea la estructura `backend/functions/src/test/`.
4.  Crea el `setup.ts` global para inicializar Firebase de manera offline conectado a los emuladores locales.
5.  Crea utilidades (`clearFirestore()`) para aislar los tests.
6.  Configura Docker para testing y las variables de entorno necesarias.
7.  Configura el script `npm test` en el `package.json` para que ejecute `jest --runInBand` (crucial para evitar que múltiples workers borren el emulador simultáneamente).
8.  Crea un test mínimo de validación (`dummy.test.ts`) y ejecútalo para confirmar que todo funciona.

## 3. Reglas Arquitectónicas Estrictas

-   **Framework:** Usa Jest obligatoriamente. No uses Vitest ni Mocha.
-   **Base de Datos:** Usa Firebase Emulator Suite. No uses mocks completos de Firestore/Auth.
-   **Ejecución:** Usa Docker Compose para entornos reproducibles.

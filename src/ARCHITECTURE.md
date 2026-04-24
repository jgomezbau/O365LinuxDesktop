# Arquitectura Modular

Versión documentada: `2.7.0`

O365 Linux Desktop es una aplicación Electron con módulos CommonJS. Desde la versión `2.7.0`, el punto de entrada de Electron sigue siendo `main.js`, pero ahora actúa como lanzador mínimo hacia `src/main/index.js`.

## Estructura

```text
main.js                         # Bootstrap mínimo para Electron
src/main/index.js               # Runtime principal de la aplicación
src/main/app/                   # Constantes y rutas de aplicación
src/main/ipc/                   # Registro de canales IPC
src/main/logging/               # Logs estructurados y wrappers de error
src/main/navigation/            # Reglas puras de URL, popups y restauración
src/main/favorites/             # Clasificación y persistencia de favoritos
src/main/tabs/                  # Persistencia y restauración de pestañas
src/main/tray/                  # Construcción del tray y menús
src/main/native/                # Integración con aplicaciones nativas Linux
src/main/workers/               # Worker threads para trabajo nativo lento
src/main/windows/               # Controladores de ventanas auxiliares
src/config/                     # Persistencia con electron-store
src/preload/                    # Puentes seguros de IPC
src/ui/                         # Renderers HTML/CSS/JS
```

## Responsabilidades

- `src/main/app/constants.js`: constantes compartidas del proceso main.
- `src/main/app/paths.js`: rutas absolutas derivadas desde la raíz del proyecto.
- `src/main/ipc/registerIpcHandlers.js`: registro centralizado de eventos y handlers IPC.
- `src/main/logging/logger.js`: salida JSON estructurada.
- `src/main/logging/errorBoundary.js`: wrappers para handlers IPC.
- `src/main/navigation/officeUrlService.js`: normalización de URLs Microsoft 365 y detección de documentos Office.
- `src/main/navigation/popupRules.js`: reglas de popups OAuth/Outlook.
- `src/main/navigation/restorableUrl.js`: limpieza de URLs antes de persistirlas.
- `src/main/navigation/urlRules.js`: decisión de apertura interna/externa de URLs.
- `src/main/favorites/favoriteClassifier.js`: inferencia de tipo, título e icono.
- `src/main/favorites/favoriteService.js`: API testeable para favoritos.
- `src/main/tabs/tabPersistence.js`: persistencia y restauración secuencial de pestañas.
- `src/main/tray/trayManager.js`: creación y reconstrucción del tray, incluyendo iconos en favoritos y submenú `Aplicaciones`.
- `src/main/native/nativeAppService.js`: fachada async para apps nativas.
- `src/main/workers/nativeApp.worker.js`: detección, descarga y apertura nativa fuera del hilo principal.
- `src/main/windows/popupWindowService.js`: creación, seguimiento y logging de ventanas popup gestionadas.
- `src/main/windows/tabDragGhostWindow.js`: ventana fantasma de arrastre de tabs.

## Worker Threads

La integración nativa Linux puede ejecutar `which`, `curl` y aplicaciones externas. Esa responsabilidad se mueve detrás de `nativeAppService`, que se comunica con `nativeApp.worker.js` usando `worker_threads`.

El contrato del worker es:

```js
workerClient.request('getAvailableAppsForFile', { filePath });
workerClient.request('downloadAndOpenWithApp', { url, appCommand });
```

Las respuestas se normalizan como:

```js
{ ok: true, result }
{ ok: false, error: { message } }
```

## Estado Actual De La Migración

El corte `2.7.0` conserva el comportamiento existente y reduce riesgo:

- `main.js` ya es un bootstrap mínimo.
- `src/main/index.js` usa rutas centralizadas, constantes, logger estructurado, `nativeAppService`, `favoriteService`, `trayManager`, `popupWindowService`, reglas de navegación extraídas y controlador de ventana fantasma.
- Los canales IPC están fuera del runtime principal en `src/main/ipc/registerIpcHandlers.js`.
- La lógica pura extraída ya sustituyó varios bloques equivalentes que vivían en `src/main/index.js`.
- La carpeta heredada `src/utils/` fue eliminada; no debe añadirse código nuevo ahí.
- La integración con aplicaciones nativas Linux ya dispone de worker dedicado para aislar operaciones lentas.
- La documentación del repo ya incluye el mapa de responsabilidades y la estrategia de migración.

El siguiente corte recomendado es mover `tabManager`, creación de `WebContentsView` y navegación por pestaña para adelgazar `src/main/index.js`.

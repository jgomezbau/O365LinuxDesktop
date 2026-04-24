# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

## [Unreleased]

## [2.7.0] - 2026-04-24

### Added
- Nuevo documento de arquitectura en `src/ARCHITECTURE.md` con la estructura modular propuesta, responsabilidades por módulo y contrato de `worker_threads`.
- Nuevo runtime principal en `src/main/index.js`, dejando `main.js` como bootstrap mínimo de Electron.
- Módulos de aplicación para constantes y rutas absolutas: `src/main/app/constants.js` y `src/main/app/paths.js`.
- Módulos de logging estructurado y envoltorios de error para IPC en `src/main/logging/`.
- Módulos de navegación testeables para URLs de Microsoft 365, reglas de popups y limpieza de URLs restaurables en `src/main/navigation/`.
- Servicios dedicados para favoritos y tray en `src/main/favorites/` y `src/main/tray/`.
- Módulo `src/main/tabs/tabPersistence.js` para persistencia y restauración secuencial de pestañas.
- Registro centralizado de IPC en `src/main/ipc/registerIpcHandlers.js`.
- Servicio de integración nativa Linux en `src/main/native/`, con catálogo de aplicaciones separado.
- Infraestructura de `worker_threads` en `src/main/workers/` para aislar detección de apps nativas, descargas con `curl` y apertura de archivos externos fuera del hilo principal.
- Controlador dedicado para la ventana fantasma de arrastre de pestañas en `src/main/windows/tabDragGhostWindow.js`.
- Servicio dedicado para popups gestionados en `src/main/windows/popupWindowService.js`.

### Changed
- Refactorización arquitectónica incremental para mejorar separación de responsabilidades, cohesión y testabilidad sin cambiar el contrato visible de la aplicación.
- Centralización de rutas de recursos, preload scripts, HTML e iconos mediante `createAppPaths`.
- Reemplazo del flujo de integración nativa directa por una fachada async (`nativeAppService`) respaldada por worker.
- Conexión efectiva de los módulos extraídos desde `src/main/index.js`, reduciendo duplicación en favoritos, tray, reglas de navegación, popups, URLs restaurables, persistencia de pestañas, IPC y ventana fantasma de arrastre.
- El submenú `Aplicaciones` de la bandeja ahora muestra iconos de Word, Excel, PowerPoint, Outlook, OneDrive, Teams y OneNote.
- Refactorización acotada previa de `main.js` para reforzar su papel de entrada y composición, moviendo la gestión de sesión, estado de ventana principal y ciclo de vida del modal flotante a módulos dedicados en `src/main/`.
- Reorganización de la UI bajo `src/ui/`, separando claramente la ventana principal (`src/ui/main-window/`), el modal flotante (`src/ui/modal/`) y los estilos compartidos (`src/ui/shared/`).
- Consolidación de los preload scripts bajo `src/preload/`, incluyendo el traslado de `modal-preload.js` y del preload principal a rutas más coherentes con su responsabilidad.
- Reubicación de los iconos de runtime a `src/assets/icons/` y de los iconos de empaquetado a `icons/`, evitando depender de `build/` para conservar esos recursos.
- Actualización de rutas de carga, referencias internas y documentación para alinearlas con la nueva estructura del proyecto.

### Maintenance
- Validación de sintaxis de todos los archivos JavaScript con `node -c`.
- Eliminación de la carpeta heredada `src/utils/`: `nativeAppHandler.js` fue reemplazado por `src/main/native/` + `src/main/workers/`, y `urlHandler.js` se movió a `src/main/navigation/urlRules.js`.
- Simplificación adicional de la raíz del repositorio para que `src/` concentre el código y assets de ejecución, dejando una estructura más clara y fácil de mantener.

## [2.6.1] - 2026-04-10

### Added
- Sistema de overflow horizontal para pestañas con navegación por flechas.
- Desacople de pestañas a ventanas separadas desde la tarjeta contextual y mediante drag fuera de la barra.
- Tarjeta contextual flotante para pestañas con icono, servicio, ubicación inferida, último guardado, favorito y acción de desacople.
- Persistencia de favoritos y submenú `Favoritos` en la bandeja del sistema.
- Submenú `Aplicaciones` en la bandeja con accesos a Word, Excel, PowerPoint, Outlook, OneDrive, Teams y OneNote.
- Restauración opcional de pestañas/documentos al iniciar.
- Persistencia del tamaño, posición y estado maximizado de la ventana principal.
- Soporte para compartir pantalla mediante `desktopCapturer`.
- Ventanas flotantes dedicadas para configuración, lanzador de aplicaciones y tarjeta de información de pestaña.

### Changed
- Migración del contenido principal a `WebContentsView`.
- Ejecución de desarrollo alineada con X11 por defecto, con script explícito para pruebas en Wayland.
- Mejora del menú contextual para enlaces, imágenes y apertura con aplicaciones nativas en Linux.
- Normalización de títulos, iconos y metadatos visibles para pestañas y favoritos.
- La pestaña principal queda fijada visualmente como `M365 Copilot` y no participa en drag ni en la tarjeta de información.
- El README se actualizó para reflejar el comportamiento real actual de la aplicación.

### Fixed
- Restauración más estable de pestañas al iniciar, con reapertura secuencial.
- Mejor manejo de popups internos de Microsoft 365, incluyendo flujos de Outlook.
- Validación de bounds para evitar reabrir la ventana fuera de pantalla en configuraciones multi-monitor.
- Integración más consistente de portapapeles y atajos heredados como `Shift+Insert` y `Shift+Delete`.
- Inclusión de `modal-preload.js` en los artefactos Linux empaquetados.
- Inicialización robusta de `electron-store` con `electron-store@11`.
- Corrección del recorte vertical en la tarjeta contextual de pestañas cuando el título ocupaba dos líneas: se mantuvo el ancho fijo esperado, se amplió la altura de la ventana flotante anfitriona y se dio algo más de margen útil al contenido para evitar que se perdiera la parte inferior.

### Maintenance
- Limpieza conservadora de código legado, utilidades huérfanas y trazas residuales.
- Simplificación del preload expuesto al renderer.
- Alineación de branding, documentación y metadata del proyecto con `O365 Linux Desktop`.

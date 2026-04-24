const TAB_DRAG_GHOST_WIDTH = 320;
const TAB_DRAG_GHOST_HEIGHT = 188;
const TAB_DRAG_GHOST_OFFSET_X = 18;
const TAB_DRAG_GHOST_OFFSET_Y = 16;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getTabDragGhostHtml(title = '') {
  const safeTitle = escapeHtml(title || 'Ventana separada');
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: transparent; font-family: 'Segoe UI', sans-serif; }
    body { display: flex; align-items: stretch; justify-content: stretch; padding: 0; }
    .ghost-window { width: 100%; height: 100%; border-radius: 14px; border: 1px solid rgba(255,255,255,0.18); background: rgba(28,32,38,0.34); box-shadow: 0 18px 44px rgba(0,0,0,0.28); backdrop-filter: blur(2px); overflow: hidden; }
    .ghost-titlebar { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 14px; background: rgba(255,255,255,0.07); border-bottom: 1px solid rgba(255,255,255,0.08); }
    .ghost-dot { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,0.28); flex: 0 0 auto; }
    .ghost-title { min-width: 0; color: rgba(255,255,255,0.88); font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ghost-body { display: flex; flex-direction: column; gap: 12px; padding: 18px 16px; }
    .ghost-line { height: 12px; border-radius: 999px; background: rgba(255,255,255,0.16); }
    .ghost-line.short { width: 42%; }
    .ghost-line.medium { width: 64%; }
    .ghost-line.long { width: 88%; }
    .ghost-panel { margin-top: 4px; height: 78px; border-radius: 10px; border: 1px dashed rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); }
  </style>
</head>
<body>
  <div class="ghost-window">
    <div class="ghost-titlebar">
      <div class="ghost-dot"></div>
      <div class="ghost-title">${safeTitle}</div>
    </div>
    <div class="ghost-body">
      <div class="ghost-line short"></div>
      <div class="ghost-line long"></div>
      <div class="ghost-line medium"></div>
      <div class="ghost-panel"></div>
    </div>
  </div>
</body>
</html>`;
}

function createTabDragGhostController({ BrowserWindow, screen, getMainWindow }) {
  let ghostWindow = null;
  let followInterval = null;

  function updatePosition(screenX = 0, screenY = 0) {
    if (!ghostWindow || ghostWindow.isDestroyed()) return;
    ghostWindow.setBounds({
      x: Math.round(screenX + TAB_DRAG_GHOST_OFFSET_X),
      y: Math.round(screenY + TAB_DRAG_GHOST_OFFSET_Y),
      width: TAB_DRAG_GHOST_WIDTH,
      height: TAB_DRAG_GHOST_HEIGHT
    }, false);
  }

  function ensureWindow(title = '') {
    if (!ghostWindow || ghostWindow.isDestroyed()) {
      ghostWindow = new BrowserWindow({
        width: TAB_DRAG_GHOST_WIDTH,
        height: TAB_DRAG_GHOST_HEIGHT,
        show: false,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        closable: false,
        focusable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        hasShadow: true,
        fullscreenable: false,
        parent: getMainWindow() || undefined,
        webPreferences: {
          sandbox: true,
          backgroundThrottling: false,
          contextIsolation: true,
          nodeIntegration: false
        }
      });

      ghostWindow.setMenuBarVisibility(false);
      ghostWindow.setIgnoreMouseEvents(true, { forward: true });
      ghostWindow.on('closed', () => {
        ghostWindow = null;
      });
    }

    if (ghostWindow.__ghostTitle !== title) {
      ghostWindow.__ghostTitle = title;
      ghostWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getTabDragGhostHtml(title))}`);
    }

    return ghostWindow;
  }

  function stopFollow() {
    if (!followInterval) return;
    clearInterval(followInterval);
    followInterval = null;
  }

  function startFollow() {
    stopFollow();
    followInterval = setInterval(() => {
      if (!ghostWindow || ghostWindow.isDestroyed() || !ghostWindow.isVisible()) {
        stopFollow();
        return;
      }

      const point = screen.getCursorScreenPoint();
      updatePosition(point.x, point.y);
    }, 16);
  }

  function show(payload = {}) {
    const title = typeof payload.title === 'string' ? payload.title : '';
    const fallbackPoint = screen.getCursorScreenPoint();
    const screenX = Number(payload.screenX) || fallbackPoint.x;
    const screenY = Number(payload.screenY) || fallbackPoint.y;
    const targetWindow = ensureWindow(title);
    if (!targetWindow) return;

    targetWindow.showInactive();
    updatePosition(screenX, screenY);
    startFollow();
  }

  function move(payload = {}) {
    const fallbackPoint = screen.getCursorScreenPoint();
    updatePosition(
      Number(payload.screenX) || fallbackPoint.x,
      Number(payload.screenY) || fallbackPoint.y
    );
  }

  function hide() {
    stopFollow();
    if (!ghostWindow || ghostWindow.isDestroyed()) return;
    ghostWindow.hide();
  }

  function destroy() {
    stopFollow();
    if (ghostWindow && !ghostWindow.isDestroyed()) {
      ghostWindow.close();
    }
    ghostWindow = null;
  }

  return {
    destroy,
    hide,
    move,
    show,
    stopFollow
  };
}

module.exports = {
  createTabDragGhostController
};

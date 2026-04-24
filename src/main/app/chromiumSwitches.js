function configureChromiumCommandLine(app) {
  // Evita ruido de Chromium en Linux/X11 cuando el driver no expone VSync de forma estable.
  app.commandLine.appendSwitch('disable-gpu-vsync');
}

module.exports = {
  configureChromiumCommandLine
};

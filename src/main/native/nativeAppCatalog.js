const fileTypeToAppCommand = {
  '.doc': { name: 'Word', apps: ['libreoffice --writer', 'onlyoffice-desktopeditors', 'abiword'] },
  '.docx': { name: 'Word', apps: ['libreoffice --writer', 'onlyoffice-desktopeditors', 'abiword'] },
  '.odt': { name: 'Writer', apps: ['libreoffice --writer', 'onlyoffice-desktopeditors', 'abiword'] },
  '.rtf': { name: 'Rich Text', apps: ['libreoffice --writer', 'onlyoffice-desktopeditors', 'abiword'] },
  '.txt': { name: 'Texto', apps: ['kate', 'kwrite', 'gedit', 'nano', 'vim'] },
  '.xls': { name: 'Hoja de cálculo', apps: ['libreoffice --calc', 'onlyoffice-desktopeditors', 'gnumeric'] },
  '.xlsx': { name: 'Hoja de cálculo', apps: ['libreoffice --calc', 'onlyoffice-desktopeditors', 'gnumeric'] },
  '.ods': { name: 'Calc', apps: ['libreoffice --calc', 'onlyoffice-desktopeditors', 'gnumeric'] },
  '.csv': { name: 'CSV', apps: ['libreoffice --calc', 'onlyoffice-desktopeditors', 'gnumeric'] },
  '.ppt': { name: 'PowerPoint', apps: ['libreoffice --impress', 'onlyoffice-desktopeditors'] },
  '.pptx': { name: 'PowerPoint', apps: ['libreoffice --impress', 'onlyoffice-desktopeditors'] },
  '.odp': { name: 'Impress', apps: ['libreoffice --impress', 'onlyoffice-desktopeditors'] },
  '.pdf': { name: 'PDF', apps: ['okular', 'evince', 'atril', 'xreader', 'firefox'] },
  '.jpg': { name: 'Imagen', apps: ['gwenview', 'eog', 'gimp'] },
  '.jpeg': { name: 'Imagen', apps: ['gwenview', 'eog', 'gimp'] },
  '.png': { name: 'Imagen', apps: ['gwenview', 'eog', 'gimp'] },
  '.gif': { name: 'Imagen', apps: ['gwenview', 'eog', 'gimp'] },
  '.zip': { name: 'Archivo ZIP', apps: ['ark', 'file-roller'] },
  '.rar': { name: 'Archivo RAR', apps: ['ark', 'file-roller'] },
  '.7z': { name: 'Archivo 7z', apps: ['ark', 'file-roller'] }
};

module.exports = {
  fileTypeToAppCommand
};

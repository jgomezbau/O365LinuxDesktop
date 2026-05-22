const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const ignoredDirs = new Set(['.git', 'node_modules', 'dist']);

function readJson(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function walkJavaScriptFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  entries.forEach((entry) => {
    if (ignoredDirs.has(entry.name)) return;

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJavaScriptFiles(entryPath));
      return;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(entryPath);
    }
  });

  return files;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const packageJson = readJson('package.json');
const packageLock = readJson('package-lock.json');
const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
const changelog = fs.readFileSync(path.join(rootDir, 'CHANGELOG.md'), 'utf8');

assert(packageLock.version === packageJson.version, 'package-lock.json version does not match package.json');
assert(
  packageLock.packages?.['']?.version === packageJson.version,
  'package-lock root package version does not match package.json'
);
assert(
  readme.includes(`Versión actual: \`${packageJson.version}\``),
  'README.md current version does not match package.json'
);
assert(
  changelog.includes(`## [${packageJson.version}]`),
  'CHANGELOG.md does not include the current package version'
);

walkJavaScriptFiles(rootDir).forEach((filePath) => {
  run(process.execPath, ['--check', filePath]);
});

console.log(`Checks passed for ${packageJson.name} ${packageJson.version}`);

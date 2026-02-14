#!/usr/bin/env node

/**
 * Package release artifacts into distributable archives
 * Creates platform-specific archives following common open source conventions:
 * - Windows: .zip
 * - macOS: .zip (containing .app bundle)
 * - Linux: .tar.gz
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const platform = args.find((arg) => arg.startsWith('--platform='))?.split('=')[1];
const arch = args.find((arg) => arg.startsWith('--arch='))?.split('=')[1];
const outDir = args.find((arg) => arg.startsWith('--out='))?.split('=')[1] || 'release';

if (!platform || !arch) {
  console.error('Usage: node package-release.js --platform=<platform> --arch=<arch> [--out=<dir>]');
  process.exit(1);
}

// Read package.json for version info
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
let version = packageJson.version;

// Try to get version from git tag if available (takes precedence)
try {
  const gitTag = execSync('git describe --tags --exact-match 2>/dev/null || true', {
    encoding: 'utf8',
  }).trim();
  if (gitTag && gitTag.startsWith('v')) {
    version = gitTag.substring(1); // Remove the 'v' prefix
    console.log(`Using version from git tag: ${version}`);
  }
} catch (error) {
  // Git tag not available, use package.json version
}

const appName = 'antistatic-animator';

// Determine the packaged app directory name
const packagerOutDir = `${appName}-${platform}-${arch}`;
const sourcePath = path.join(outDir, packagerOutDir);

// Check if source exists
if (!fs.existsSync(sourcePath)) {
  console.error(`Source directory not found: ${sourcePath}`);
  process.exit(1);
}

// Create archives directory if it doesn't exist
const archivesDir = path.join(outDir, 'archives');
if (!fs.existsSync(archivesDir)) {
  fs.mkdirSync(archivesDir, { recursive: true });
}

// Generate archive name based on platform
let archiveName;
let archiveExt;

const platformMap = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux',
};

const archMap = {
  x64: 'x86_64',
  arm64: 'arm64',
};

const platformName = platformMap[platform] || platform;
const archName = archMap[arch] || arch;

if (platform === 'darwin') {
  archiveName = `${appName}-${version}-${platformName}-${archName}.zip`;
  archiveExt = 'zip';
} else if (platform === 'win32') {
  archiveName = `${appName}-${version}-${platformName}-${archName}.zip`;
  archiveExt = 'zip';
} else if (platform === 'linux') {
  archiveName = `${appName}-${version}-${platformName}-${archName}.tar.gz`;
  archiveExt = 'tar.gz';
}

const archivePath = path.join(archivesDir, archiveName);

console.log(`Creating ${archiveName}...`);

try {
  // Remove existing archive if it exists
  if (fs.existsSync(archivePath)) {
    fs.unlinkSync(archivePath);
  }

  // Create archive based on platform
  const absArchivePath = path.resolve(archivePath);
  const absSourcePath = path.resolve(sourcePath);

  if (archiveExt === 'zip') {
    // Use zip for Windows and macOS
    if (process.platform === 'win32') {
      // On Windows, use PowerShell's Compress-Archive
      execSync(
        `powershell -Command "Compress-Archive -Path '${absSourcePath}' -DestinationPath '${absArchivePath}'"`,
        { stdio: 'inherit' }
      );
    } else {
      // On Unix-like systems, use zip
      const cwd = path.dirname(absSourcePath);
      const dirname = path.basename(absSourcePath);
      execSync(`cd "${cwd}" && zip -r -y "${absArchivePath}" "${dirname}"`, {
        stdio: 'inherit',
        shell: '/bin/bash',
      });
    }
  } else if (archiveExt === 'tar.gz') {
    // Use tar.gz for Linux
    const cwd = path.dirname(absSourcePath);
    const dirname = path.basename(absSourcePath);
    execSync(`cd "${cwd}" && tar -czf "${absArchivePath}" "${dirname}"`, {
      stdio: 'inherit',
      shell: '/bin/bash',
    });
  }

  console.log(`✓ Created ${archiveName}`);

  // Print file size
  const stats = fs.statSync(archivePath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`  Size: ${sizeMB} MB`);
} catch (error) {
  console.error(`Failed to create archive: ${error.message}`);
  process.exit(1);
}

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
const version = packageJson.version;
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
  if (archiveExt === 'zip') {
    // Use zip for Windows and macOS
    if (process.platform === 'win32') {
      // On Windows, use PowerShell's Compress-Archive
      execSync(
        `powershell -Command "Compress-Archive -Path '${sourcePath}' -DestinationPath '${archivePath}'"`,
        { stdio: 'inherit' }
      );
    } else {
      // On Unix-like systems, use zip
      const cwd = path.dirname(sourcePath);
      const dirname = path.basename(sourcePath);
      execSync(`cd "${cwd}" && zip -r -y "../archives/${archiveName}" "${dirname}"`, {
        stdio: 'inherit',
        shell: '/bin/bash',
      });
    }
  } else if (archiveExt === 'tar.gz') {
    // Use tar.gz for Linux
    const cwd = path.dirname(sourcePath);
    const dirname = path.basename(sourcePath);
    execSync(`cd "${cwd}" && tar -czf "../archives/${archiveName}" "${dirname}"`, {
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

#!/usr/bin/env node

const path = require('node:path');
const { parseArgs } = require('node:util');
const config = require('../packager.config.js');

function packageOptions(args) {
  const { values } = parseArgs({
    args,
    options: {
      platform: { type: 'string' },
      arch: { type: 'string' },
      out: { type: 'string', default: 'release' },
      overwrite: { type: 'boolean', default: false },
    },
  });
  return { ...config, ...values, dir: path.resolve(__dirname, '..'), asar: true };
}

if (require.main === module) {
  (async () => {
    const options = packageOptions(process.argv.slice(2));
    const { packager } = await import('@electron/packager');
    const paths = await packager(options);
    console.log(paths.join('\n'));
  })().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { packageOptions };

const fs = require('node:fs');
const path = require('node:path');

const distDirectory = path.join(__dirname, '..', 'dist');
const indexHtml = fs.readFileSync(path.join(distDirectory, 'index.html'), 'utf8');
const assetsDirectory = path.join(__dirname, '..', 'dist', 'assets');
const forbiddenJavaScript = [
  { pattern: /\beval\s*\(/, label: 'eval(...)' },
  { pattern: /\b(?:new\s+)?Function\s*\(/, label: 'Function(...) constructor' },
];

const javascriptFiles = fs
  .readdirSync(assetsDirectory)
  .filter((file) => file.endsWith('.js'))
  .map((file) => path.join(assetsDirectory, file));

if (javascriptFiles.length === 0) {
  throw new Error('The web build emitted no JavaScript assets to check');
}

if (indexHtml.includes('frame-ancestors')) {
  throw new Error(
    'frame-ancestors must be delivered as an HTTP header, not through the HTML meta CSP'
  );
}
if (!fs.existsSync(path.join(distDirectory, 'favicon.svg'))) {
  throw new Error('The web build emitted no favicon');
}

for (const file of javascriptFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const forbidden of forbiddenJavaScript) {
    if (forbidden.pattern.test(source)) {
      throw new Error(
        `${path.relative(process.cwd(), file)} contains ${forbidden.label}, which violates the web Content Security Policy`
      );
    }
  }
}

console.log(`CSP and web asset checks passed for ${javascriptFiles.length} JavaScript asset(s).`);

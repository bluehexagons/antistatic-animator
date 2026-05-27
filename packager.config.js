const { version } = require('./package.json');

module.exports = {
  name: 'Antistatic Animator',
  appVersion: version,
  // Uncomment and add icon when available
  // icon: './assets/icon',
  ignore: [
    /^\/src/,
    /^\/\.git/,
    /^\/\.vscode/,
    /^\/\.github/,
    /^\/coverage/,
    /^\/release/,
    /^\/releases/,
    /tsconfig\.json/,
    /vite\.config\.ts/,
    /eslint\.config\.mjs/,
    /\.prettierrc\.json/,
    /packager\.config\.js/,
    /\.gitignore/,
    /readme\.md/,
  ],
  extraResource: [],
};

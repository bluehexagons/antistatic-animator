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
    /tsconfig\.json/,
    /vite\.config\.ts/,
    /eslint\.config\.js/,
    /\.prettierrc\.json/,
    /packager\.config\.js/,
    /\.gitignore/,
    /readme\.md/,
  ],
  extraResource: [],
};

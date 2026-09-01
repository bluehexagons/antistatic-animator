export const rewriteStandaloneRuntimeImports = (source) =>
  source.replace(/const (\w+) = require\(("[^"]+")\)\.default;/g, (_match, binding, request) => {
    const imported = `${binding}Import`;
    return `import ${imported} from ${request};const ${binding}=typeof ${imported}==="function"?${imported}:${imported}.default;`;
  });

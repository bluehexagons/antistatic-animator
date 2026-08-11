import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import Ajv2020 from 'ajv/dist/2020.js';
import standaloneCode from 'ajv/dist/standalone/index.js';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const stageSchema = JSON.parse(fs.readFileSync('src/stage/stage.schema.json', 'utf-8'));

const stageValidatorModuleId = 'virtual:stage-validator';
const resolvedStageValidatorModuleId = `\0${stageValidatorModuleId}`;

const createStageValidatorModule = (): string => {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: false,
    code: { source: true, esm: true },
  });
  const source = standaloneCode(ajv, ajv.compile(stageSchema)).replace(
    /const (\w+) = require\(("[^"]+")\)\.default;/g,
    'import $1 from $2;'
  );
  if (source.includes('require(')) {
    throw new Error('Generated stage validator contains an unsupported CommonJS dependency');
  }
  return source;
};

export const stageValidatorPlugin = {
  name: 'stage-validator',
  resolveId(id: string) {
    return id === stageValidatorModuleId ? resolvedStageValidatorModuleId : null;
  },
  load(id: string) {
    return id === resolvedStageValidatorModuleId ? createStageValidatorModule() : null;
  },
};

export default defineConfig({
  base: process.env.VITE_BASE || './',
  plugins: [stageValidatorPlugin, react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    minify: 'esbuild',
  },
  server: {
    port: 5173,
  },
});

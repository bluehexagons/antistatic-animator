declare module '*.css';
declare module 'electron';
declare module 'virtual:stage-validator' {
  import type { ValidateFunction } from 'ajv';

  const validate: ValidateFunction;
  export default validate;
}

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

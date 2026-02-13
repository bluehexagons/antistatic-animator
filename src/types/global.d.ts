export {};

declare global {
  interface Window {
    electronAPI: {
      showOpenDialog: (
        config: Electron.OpenDialogOptions
      ) => Promise<Electron.OpenDialogReturnValue>;
    };
    nodeAPI: {
      fs: {
        existsSync: typeof import('fs').existsSync;
        readdirSync: typeof import('fs').readdirSync;
        readFileSync: typeof import('fs').readFileSync;
        writeFileSync: typeof import('fs').writeFileSync;
        watch: typeof import('fs').watch;
      };
      path: {
        resolve: typeof import('path').resolve;
        join: typeof import('path').join;
        dirname: typeof import('path').dirname;
        basename: typeof import('path').basename;
        extname: typeof import('path').extname;
      };
      process: {
        cwd: () => string;
        platform: NodeJS.Platform;
      };
    };
  }
}

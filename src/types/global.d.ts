import type { EntityData, Animation, AnimationMap } from '../animator/types';
import type { createTools } from '../animator/api/tools';
import type {
  AgentPlayOptions,
  AgentPlayReady,
  AgentPlayRequest,
  AgentPlayResponse,
  AntistaticLaunchResult,
} from '../runtime/antistatic-types';

export {};

declare global {
  interface Window {
    electronAPI: {
      showOpenDialog: (
        config: Electron.OpenDialogOptions
      ) => Promise<Electron.OpenDialogReturnValue>;
      launchAntistatic: (rootDir: string) => Promise<AntistaticLaunchResult>;
      stopAntistatic: () => Promise<void>;
      startAntistaticAgentPlay: (options: AgentPlayOptions) => Promise<AgentPlayReady>;
      requestAntistaticAgentPlay: (request: AgentPlayRequest) => Promise<AgentPlayResponse>;
      stopAntistaticAgentPlay: () => Promise<void>;
    };
    nodeAPI: {
      fs: {
        setRoot?: (rootDir: string) => void;
        existsSync: (filename: string) => boolean;
        readdirSync: (directory: string) => string[];
        readFileSync: (filename: string, encoding: BufferEncoding) => string;
        writeFileAtomic: (filename: string, content: string) => void;
        writeFileAtomicIfUnchanged?: (
          filename: string,
          content: string,
          expectedContent?: string
        ) => void;
        watch: {
          (
            filename: string,
            listener?: (event: string, filename: string | null) => void,
            onError?: (error: Error) => void
          ): () => void;
          (
            filename: string,
            options: BufferEncoding,
            listener?: (event: string, filename: string | null) => void,
            onError?: (error: Error) => void
          ): () => void;
        };
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
    editing: {
      character: EntityData | null;
      animation: Animation | null;
      keyframe: number;
      bubble: number;
    };
    parsed: AnimationMap;
    /** Console API for power users (batch keyframe/bubble ops). */
    Tools: ReturnType<typeof createTools>;
  }
}

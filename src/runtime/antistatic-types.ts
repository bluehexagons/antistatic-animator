export type AntistaticStartMode = 'press-start' | 'main' | 'versus' | 'training' | 'blank';

export interface AgentPlayRequest {
  command: string;
  id?: string | number;
  [key: string]: unknown;
}

export interface AgentPlayObservation {
  frame?: number;
  scene?: string;
  sceneFrame?: number;
  sceneInputReady?: boolean;
  gamePaused?: boolean;
  controllers?: Array<{
    controllerID?: number;
    portNumber?: number;
    character?: string;
    input?: Record<string, unknown>;
  }>;
  players?: Array<{
    playerNumber?: number;
    name?: string;
    animation?: string;
    damage?: number;
    x?: number;
    y?: number;
  }>;
  menu?: { focusedId?: string; nodes?: unknown[] } | null;
  [key: string]: unknown;
}

export interface AgentPlayReady {
  type: 'ready';
  protocolVersion: number;
  startMode: AntistaticStartMode;
  capabilities?: { screenshots?: boolean };
  observation?: AgentPlayObservation;
  [key: string]: unknown;
}

export interface AgentPlayResponse {
  type: 'response';
  id?: string | number;
  command?: string;
  ok: boolean;
  observation?: AgentPlayObservation;
  error?: { code?: string; message?: string; details?: unknown };
  [key: string]: unknown;
}

export interface AgentPlayOptions {
  rootDir: string;
  startMode: AntistaticStartMode;
  compile: boolean;
  render: boolean;
  softwareGl: boolean;
  resolution: string;
  /** Optional headless startup screen, e.g. Antistatic's training-menu. */
  headlessMenu?: string;
  /** Stage passed to headless startup screens that support stage selection. */
  stage?: string;
  /** Character attached to the first scripted controller after startup. */
  character?: string;
}

export interface AntistaticLaunchResult {
  path: string;
  command: string;
}

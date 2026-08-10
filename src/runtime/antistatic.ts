import {
  spawn,
  spawnSync,
  type ChildProcess,
  type ChildProcessWithoutNullStreams,
} from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix, resolve, win32 } from 'node:path';

import type {
  AgentPlayOptions,
  AgentPlayReady,
  AgentPlayRequest,
  AgentPlayResponse,
  AntistaticLaunchResult,
} from './antistatic-types';

const AGENT_PLAY_PROTOCOL_VERSION = 1;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_DIAGNOSTICS = 12_000;

const executableName = (platform: NodeJS.Platform) =>
  platform === 'win32' ? 'Antistatic.exe' : 'Antistatic';
const nodeExecutableName = (platform: NodeJS.Platform) =>
  platform === 'win32' ? 'node.exe' : 'node';
const npmExecutableName = (platform: NodeJS.Platform) => (platform === 'win32' ? 'npm.cmd' : 'npm');

export const antistaticExecutableCandidates = (
  rootDir: string,
  platform = process.platform
): string[] => {
  const pathApi = platform === 'win32' ? win32 : posix;
  const root = pathApi.resolve(rootDir);
  const name = executableName(platform as NodeJS.Platform);
  return [pathApi.join(root, 'Release', name), pathApi.join(root, name)];
};

export const resolveAntistaticExecutable = (
  rootDir: string,
  platform = process.platform,
  exists: (filename: string) => boolean = existsSync
): string | null => antistaticExecutableCandidates(rootDir, platform).find(exists) ?? null;

const isAntistaticSourceRoot = (rootDir: string): boolean => {
  try {
    const packageData = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')) as {
      name?: string;
      scripts?: { start?: string };
    };
    return (
      packageData.name === 'antistatic' &&
      typeof packageData.scripts?.start === 'string' &&
      existsSync(join(rootDir, 'scripts', 'agent-play.mjs'))
    );
  } catch {
    return false;
  }
};

const hasPackagedRuntime = (launcher: string, platform: NodeJS.Platform): boolean => {
  const installDir = dirname(launcher);
  return (
    existsSync(join(installDir, nodeExecutableName(platform))) &&
    existsSync(join(installDir, 'app', 'dist', 'src', 'engine.js'))
  );
};

interface GameLaunchSpec {
  command: string;
  args: string[];
  cwd: string;
  path: string;
}

const resolveGameLaunch = (rootDir: string): GameLaunchSpec => {
  const root = resolve(rootDir);
  const platform = process.platform;
  const executable = antistaticExecutableCandidates(root, platform).find(
    (candidate) =>
      existsSync(candidate) && hasPackagedRuntime(candidate, platform as NodeJS.Platform)
  );
  if (executable) {
    return { command: executable, args: [], cwd: dirname(executable), path: executable };
  }
  if (isAntistaticSourceRoot(root)) {
    return {
      command: npmExecutableName(platform as NodeJS.Platform),
      args: ['run', 'start'],
      cwd: root,
      path: `${npmExecutableName(platform as NodeJS.Platform)} run start`,
    };
  }
  throw new Error(
    'No runnable Antistatic installation was found. Select the Antistatic repository or a packaged Release directory.'
  );
};

export const buildAgentPlayArgs = (
  options: Pick<AgentPlayOptions, 'startMode' | 'compile' | 'render' | 'softwareGl' | 'resolution'>
): string[] => {
  const args = ['run', '--silent', 'agent:play', '--'];
  if (!options.compile) args.push('--no-compile');
  args.push('--start', options.startMode, '--timeout-ms', String(DEFAULT_TIMEOUT_MS));
  if (options.render || options.softwareGl)
    args.push('--render', '--resolution', options.resolution);
  if (options.softwareGl) args.push('--software-gl');
  return args;
};

export const buildAgentPlayEnvironment = (
  options: Pick<AgentPlayOptions, 'headlessMenu' | 'stage'>,
  baseEnvironment: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv => {
  const environment = { ...baseEnvironment };
  if (options.headlessMenu) environment.ANTISTATIC_HEADLESS_MENU = options.headlessMenu;
  else delete environment.ANTISTATIC_HEADLESS_MENU;
  if (options.stage) environment.ANTISTATIC_HEADLESS_STAGE = options.stage;
  else delete environment.ANTISTATIC_HEADLESS_STAGE;
  return environment;
};

const isRunning = (child: ChildProcess): boolean =>
  child.exitCode === null && child.signalCode === null;

const signalProcessTree = (child: ChildProcess, signal: NodeJS.Signals) => {
  if (!isRunning(child) || !child.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
};

const waitForExit = (child: ChildProcess, timeoutMs: number): Promise<void> =>
  new Promise((resolveExit, rejectExit) => {
    if (!isRunning(child)) {
      resolveExit();
      return;
    }
    const timer = setTimeout(() => {
      child.removeListener('exit', onExit);
      rejectExit(new Error(`Antistatic process did not exit within ${timeoutMs}ms`));
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timer);
      resolveExit();
    };
    child.once('exit', onExit);
  });

const stopProcessTree = async (child: ChildProcess): Promise<void> => {
  if (!isRunning(child)) return;
  signalProcessTree(child, 'SIGTERM');
  try {
    await waitForExit(child, 1_500);
  } catch {
    signalProcessTree(child, 'SIGKILL');
    await waitForExit(child, 1_500).catch(() => undefined);
  }
};

type RecordWaiter = {
  resolve: (record: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

class AgentPlaySession {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly lines: Interface;
  private readonly queuedRecords: Record<string, unknown>[] = [];
  private readonly waiters: RecordWaiter[] = [];
  private diagnosticsText = '';
  private terminalError: Error | null = null;
  private requestActive = false;
  private nextRequestId = 1;
  private closed = false;

  private constructor(child: ChildProcessWithoutNullStreams) {
    this.child = child;
    this.lines = createInterface({ crlfDelay: Infinity, input: child.stdout });
    this.lines.on('line', (line) => {
      this.appendDiagnostics(line);
      try {
        const record = JSON.parse(line) as Record<string, unknown>;
        const waiter = this.waiters.shift();
        if (waiter) {
          clearTimeout(waiter.timer);
          waiter.resolve(record);
        } else {
          this.queuedRecords.push(record);
        }
      } catch (error) {
        this.fail(
          new Error(`Antistatic agent-play emitted invalid JSON: ${(error as Error).message}`)
        );
      }
    });
    child.stderr.on('data', (chunk) => this.appendDiagnostics(String(chunk)));
    child.on('error', (error) =>
      this.fail(new Error(`Unable to start Antistatic agent-play: ${error.message}`))
    );
    child.on('exit', (code, signal) => {
      if (!this.closed) {
        const reason = signal === null ? `code ${code}` : `signal ${signal}`;
        this.fail(new Error(`Antistatic agent-play exited with ${reason}${this.diagnostics()}`));
      }
    });
  }

  static async start(
    options: AgentPlayOptions
  ): Promise<{ session: AgentPlaySession; ready: AgentPlayReady }> {
    const runnerArgs = buildAgentPlayArgs(options);
    const npm = npmExecutableName(process.platform);
    const renderEnabled = options.render || options.softwareGl;
    let command = npm;
    let args = runnerArgs;
    if (renderEnabled && process.platform === 'linux' && !process.env.DISPLAY) {
      command = 'xvfb-run';
      args = ['-a', npm, ...runnerArgs];
    }
    const child = spawn(command, args, {
      cwd: resolve(options.rootDir),
      detached: process.platform !== 'win32',
      env: buildAgentPlayEnvironment(options),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const session = new AgentPlaySession(child);
    try {
      const ready = (await session.readRecord('agent-play startup')) as AgentPlayReady;
      if (ready.type !== 'ready' || ready.protocolVersion !== AGENT_PLAY_PROTOCOL_VERSION) {
        throw new Error(
          `Antistatic agent-play returned an invalid ready record${session.diagnostics()}`
        );
      }
      return { session, ready };
    } catch (error) {
      await session.close();
      throw error;
    }
  }

  async request(request: AgentPlayRequest): Promise<AgentPlayResponse> {
    if (this.closed || !isRunning(this.child))
      throw this.terminalError ?? new Error('Antistatic agent-play is not running');
    if (this.requestActive)
      throw new Error('Antistatic agent-play requests must be sent sequentially');
    this.requestActive = true;
    const id = request.id ?? `animator-${this.nextRequestId++}`;
    try {
      await new Promise<void>((resolveWrite, rejectWrite) => {
        this.child.stdin.write(`${JSON.stringify({ ...request, id })}\n`, (error) => {
          if (error) rejectWrite(error);
          else resolveWrite();
        });
      });
      const response = (await this.readRecord(
        `agent-play ${request.command}`
      )) as AgentPlayResponse;
      if (response.type !== 'response' || response.id !== id) {
        throw new Error(
          `Antistatic agent-play returned an unexpected response${this.diagnostics()}`
        );
      }
      return response;
    } finally {
      this.requestActive = false;
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      if (isRunning(this.child) && !this.requestActive) {
        this.closed = false;
        await this.request({ command: 'quit' }).catch(() => undefined);
        this.closed = true;
        await waitForExit(this.child, 3_000).catch(() => undefined);
      }
    } finally {
      this.closed = true;
      this.lines.close();
      await stopProcessTree(this.child);
    }
  }

  private readRecord(label: string): Promise<Record<string, unknown>> {
    if (this.queuedRecords.length > 0) return Promise.resolve(this.queuedRecords.shift()!);
    if (this.terminalError) return Promise.reject(this.terminalError);
    return new Promise((resolveRecord, rejectRecord) => {
      const waiter = {
        resolve: resolveRecord,
        reject: rejectRecord,
        timer: setTimeout(() => {
          const index = this.waiters.indexOf(waiter);
          if (index !== -1) this.waiters.splice(index, 1);
          rejectRecord(
            new Error(`${label} timed out after ${DEFAULT_TIMEOUT_MS}ms${this.diagnostics()}`)
          );
        }, DEFAULT_TIMEOUT_MS),
      };
      this.waiters.push(waiter);
    });
  }

  private fail(error: Error) {
    if (this.terminalError) return;
    this.terminalError = error;
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift()!;
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }

  private appendDiagnostics(text: string) {
    this.diagnosticsText = `${this.diagnosticsText}${text}`.slice(-MAX_DIAGNOSTICS);
  }

  private diagnostics() {
    return this.diagnosticsText ? `\n${this.diagnosticsText}` : '';
  }
}

export class AntistaticProcessManager {
  private gameProcess: ChildProcess | null = null;
  private gamePath = '';
  private agentSession: AgentPlaySession | null = null;

  async launchGame(rootDir: string): Promise<AntistaticLaunchResult> {
    if (this.gameProcess && isRunning(this.gameProcess)) {
      return { command: this.gamePath, path: this.gamePath };
    }
    const launch = resolveGameLaunch(rootDir);
    const child = spawn(launch.command, launch.args, {
      cwd: launch.cwd,
      detached: process.platform !== 'win32',
      stdio: 'ignore',
    });
    this.gameProcess = child;
    this.gamePath = launch.path;
    child.once('exit', () => {
      if (this.gameProcess === child) {
        this.gameProcess = null;
        this.gamePath = '';
      }
    });
    child.once('error', () => {
      if (this.gameProcess === child) {
        this.gameProcess = null;
        this.gamePath = '';
      }
    });
    child.unref();
    return { command: launch.command, path: launch.path };
  }

  async stopGame(): Promise<void> {
    if (!this.gameProcess) return;
    const child = this.gameProcess;
    this.gameProcess = null;
    this.gamePath = '';
    await stopProcessTree(child);
  }

  async startAgentPlay(options: AgentPlayOptions): Promise<AgentPlayReady> {
    await this.stopAgentPlay();
    const { session, ready } = await AgentPlaySession.start(options);
    this.agentSession = session;
    return ready;
  }

  async requestAgentPlay(request: AgentPlayRequest): Promise<AgentPlayResponse> {
    if (!this.agentSession) throw new Error('No Antistatic headless test session is running');
    return this.agentSession.request(request);
  }

  async stopAgentPlay(): Promise<void> {
    const session = this.agentSession;
    this.agentSession = null;
    if (session) await session.close();
  }

  async dispose(): Promise<void> {
    await Promise.all([this.stopGame(), this.stopAgentPlay()]);
  }
}

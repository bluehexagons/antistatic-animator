import { describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix, win32 } from 'node:path';
import {
  antistaticExecutableCandidates,
  buildAgentPlayArgs,
  buildAgentPlayEnvironment,
  resolveAntistaticExecutable,
  AntistaticProcessManager,
} from '../runtime/antistatic';

describe('Antistatic launch helpers', () => {
  it('finds packaged launchers in the platform-specific locations', () => {
    expect(antistaticExecutableCandidates('/games/antistatic', 'linux')).toEqual([
      posix.join('/games/antistatic', 'Release', 'Antistatic'),
      posix.join('/games/antistatic', 'Antistatic'),
    ]);
    expect(antistaticExecutableCandidates('C:\\games\\antistatic', 'win32')).toEqual([
      win32.join('C:\\games\\antistatic', 'Release', 'Antistatic.exe'),
      win32.join('C:\\games\\antistatic', 'Antistatic.exe'),
    ]);
  });

  it('returns the first available launcher without touching the filesystem', () => {
    const candidates = antistaticExecutableCandidates('/games/antistatic', 'linux');
    expect(
      resolveAntistaticExecutable(
        '/games/antistatic',
        'linux',
        (filename) => filename === candidates[1]
      )
    ).toBe(candidates[1]);
    expect(resolveAntistaticExecutable('/games/antistatic', 'linux', () => false)).toBeNull();
  });

  it('builds strict agent-play arguments for deterministic sessions', () => {
    expect(
      buildAgentPlayArgs({
        startMode: 'training',
        compile: false,
        render: true,
        softwareGl: true,
        resolution: '640x360',
      })
    ).toEqual([
      'scripts/agent-play.mjs',
      '--no-compile',
      '--start',
      'training',
      '--timeout-ms',
      '30000',
      '--render',
      '--resolution',
      '640x360',
      '--software-gl',
    ]);
  });

  it('launches source and agent-play through external Node in a spaced checkout', async () => {
    const root = mkdtempSync(join(tmpdir(), 'animator game & fixture '));
    const manager = new AntistaticProcessManager();
    try {
      mkdirSync(join(root, 'scripts'));
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ name: 'antistatic', scripts: { start: 'fixture' } })
      );
      writeFileSync(
        join(root, 'scripts', 'run-local.mjs'),
        `
        import { writeFileSync } from 'node:fs';
        writeFileSync('launched.json', JSON.stringify({ execPath: process.execPath, args: process.argv.slice(2) }));
        setInterval(() => {}, 1000);
      `
      );
      writeFileSync(
        join(root, 'scripts', 'agent-play.mjs'),
        `
        import { createInterface } from 'node:readline';
        console.log(JSON.stringify({ type: 'ready', protocolVersion: 1, startMode: 'training' }));
        createInterface({ input: process.stdin }).on('line', line => {
          const request = JSON.parse(line);
          console.log(JSON.stringify({ type: 'response', id: request.id, ok: true }));
          if (request.command === 'quit') process.exit(0);
        });
      `
      );
      await manager.launchGame(root);
      await vi.waitFor(() =>
        expect(JSON.parse(readFileSync(join(root, 'launched.json'), 'utf8')).args).toEqual([])
      );
      await manager.stopGame();
      const ready = await manager.startAgentPlay({
        rootDir: root,
        startMode: 'training',
        compile: false,
        render: false,
        softwareGl: false,
        resolution: '640x360',
      });
      expect(ready.startMode).toBe('training');
      expect((await manager.requestAgentPlay({ command: 'observe' })).ok).toBe(true);
    } finally {
      await manager.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('maps debug startup options to isolated headless environment values', () => {
    expect(
      buildAgentPlayEnvironment(
        {
          headlessMenu: 'training-menu',
          stage: 'Debug',
          versusPlayers: ['Silicon'],
          versusCpus: 1,
          versusCpuLevel: 4,
          versusCpuCharacter: 'Carbon',
        },
        { PATH: '/bin', ANTISTATIC_HEADLESS_STAGE: 'Ruins' }
      )
    ).toMatchObject({
      PATH: '/bin',
      ANTISTATIC_HEADLESS_MENU: 'training-menu',
      ANTISTATIC_HEADLESS_STAGE: 'Debug',
      ANTISTATIC_HEADLESS_VERSUS_PLAYERS: 'Silicon',
      ANTISTATIC_HEADLESS_VERSUS_CPUS: '1',
      ANTISTATIC_HEADLESS_VERSUS_CPU_LEVEL: '4',
      ANTISTATIC_HEADLESS_VERSUS_CPU_CHARACTER: 'Carbon',
    });
    expect(
      buildAgentPlayEnvironment({}, { ANTISTATIC_HEADLESS_MENU: 'training-menu' })
    ).not.toHaveProperty('ANTISTATIC_HEADLESS_MENU');
  });
});

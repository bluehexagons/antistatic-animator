import { describe, expect, it } from 'vitest';
import { join, win32 } from 'node:path';
import {
  antistaticExecutableCandidates,
  buildAgentPlayArgs,
  buildAgentPlayEnvironment,
  resolveAntistaticExecutable,
} from '../runtime/antistatic';

describe('Antistatic launch helpers', () => {
  it('finds packaged launchers in the platform-specific locations', () => {
    expect(antistaticExecutableCandidates('/games/antistatic', 'linux')).toEqual([
      join('/games/antistatic', 'Release', 'Antistatic'),
      join('/games/antistatic', 'Antistatic'),
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
      'run',
      '--silent',
      'agent:play',
      '--',
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

  it('maps debug startup options to isolated headless environment values', () => {
    expect(
      buildAgentPlayEnvironment(
        { headlessMenu: 'training-menu', stage: 'Debug' },
        { PATH: '/bin', ANTISTATIC_HEADLESS_STAGE: 'Ruins' }
      )
    ).toMatchObject({
      PATH: '/bin',
      ANTISTATIC_HEADLESS_MENU: 'training-menu',
      ANTISTATIC_HEADLESS_STAGE: 'Debug',
    });
    expect(
      buildAgentPlayEnvironment({}, { ANTISTATIC_HEADLESS_MENU: 'training-menu' })
    ).not.toHaveProperty('ANTISTATIC_HEADLESS_MENU');
  });
});

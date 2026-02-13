/**
 * Test setup file
 * Runs before all tests to configure the test environment
 */

import { vi } from 'vitest';

// Mock Electron APIs that don't exist in test environment
// Note: global.window is already defined in happy-dom, no need to mock

// Mock canvas context for happy-dom
if (typeof HTMLCanvasElement !== 'undefined') {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (contextType: string, ...args: any[]) {
    if (contextType === '2d') {
      // Create a mock 2D context with all required methods
      return {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        arc: vi.fn(),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        canvas: this,
      } as any;
    }
    return originalGetContext.call(this, contextType, ...args);
  };
}

// Mock characterData for tests
const mockCharacterData = new Map();
mockCharacterData.set('test_character.json', {
  content: JSON.stringify({
    name: 'TestCharacter',
    hurtbubbles: [
      { name: 'head', i1: 0, i2: 1, z: 0, ik: false },
      { name: 'body', i1: 1, i2: 2, z: 0, ik: false },
    ],
  }),
});
mockCharacterData.set('test_character_anim.json', {
  content: JSON.stringify({
    idle: {
      keyframes: [
        { duration: 10, hurtbubbles: [0, 10, 5, 0, 0, 0, 5, 0, 0, -10, 5, 0] },
        { duration: 10, hurtbubbles: [0, 10, 5, 0, 0, 0, 5, 0, 0, -10, 5, 0] },
      ],
    },
  }),
});

// Mock utils module
vi.mock('../utils', () => ({
  characterData: mockCharacterData,
  characterDir: '/mock/character/dir',
  objHas: (obj: any, key: string) => Object.prototype.hasOwnProperty.call(obj, key),
  updateAppDir: vi.fn(),
  watchCharacters: vi.fn(),
}));

// Mock runtime modules
vi.mock('../runtime/path', () => ({
  default: {
    resolve: (...args: string[]) => args.join('/'),
    join: (...args: string[]) => args.join('/'),
  },
}));

vi.mock('../runtime/fs', () => ({
  default: {
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
  },
}));

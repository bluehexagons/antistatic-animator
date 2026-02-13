/**
 * Tests for canvas utility functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { pathCircle, pathCapsule } from '../animator/rendering/canvas-utils';

describe('Canvas Utilities', () => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    ctx = canvas.getContext('2d')!;
  });

  describe('pathCircle', () => {
    it('should create a circular path', () => {
      // Should not throw
      expect(() => {
        pathCircle(ctx, 50, 50, 20);
      }).not.toThrow();
    });

    it('should create a circular path with custom angles', () => {
      expect(() => {
        pathCircle(ctx, 50, 50, 20, 16);
      }).not.toThrow();
    });

    it('should handle zero radius', () => {
      expect(() => {
        pathCircle(ctx, 50, 50, 0);
      }).not.toThrow();
    });

    it('should handle negative coordinates', () => {
      expect(() => {
        pathCircle(ctx, -10, -10, 20);
      }).not.toThrow();
    });
  });

  describe('pathCapsule', () => {
    it('should create a capsule path between two points', () => {
      expect(() => {
        pathCapsule(ctx, 10, 10, 50, 50, 5);
      }).not.toThrow();
    });

    it('should create a capsule with custom angles', () => {
      expect(() => {
        pathCapsule(ctx, 10, 10, 50, 50, 5, 8);
      }).not.toThrow();
    });

    it('should handle identical start and end points', () => {
      expect(() => {
        pathCapsule(ctx, 25, 25, 25, 25, 5);
      }).not.toThrow();
    });

    it('should handle zero radius', () => {
      expect(() => {
        pathCapsule(ctx, 10, 10, 50, 50, 0);
      }).not.toThrow();
    });
  });
});

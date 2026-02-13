/**
 * Tests for state management modules
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { editing } from '../animator/state/EditingState';
import { dragging } from '../animator/state/DragState';
import { editorCamera } from '../animator/state/CameraState';

describe('State Management', () => {
  describe('EditingState', () => {
    beforeEach(() => {
      // Reset editing state
      editing.character = null;
      editing.animation = null;
      editing.keyframe = 0;
      editing.bubble = -1;
    });

    it('should have initial state', () => {
      expect(editing.character).toBeNull();
      expect(editing.animation).toBeNull();
      expect(editing.keyframe).toBe(0);
      expect(editing.bubble).toBe(-1);
    });

    it('should allow updating character', () => {
      const mockCharacter = {
        name: 'TestChar',
        hurtbubbles: [],
      };
      editing.character = mockCharacter as any;
      expect(editing.character).toBe(mockCharacter);
    });

    it('should allow updating keyframe index', () => {
      editing.keyframe = 5;
      expect(editing.keyframe).toBe(5);
    });

    it('should allow updating bubble selection', () => {
      editing.bubble = 2;
      expect(editing.bubble).toBe(2);
    });
  });

  describe('DragState', () => {
    beforeEach(() => {
      // Reset drag state
      dragging.active = -1;
      dragging.x = 0;
      dragging.y = 0;
      dragging.action = 0;
      dragging.startX = 0;
      dragging.startY = 0;
    });

    it('should have initial state', () => {
      expect(dragging.active).toBe(-1);
      expect(dragging.x).toBe(0);
      expect(dragging.y).toBe(0);
      expect(dragging.action).toBe(0);
    });

    it('should track drag position', () => {
      dragging.x = 100;
      dragging.y = 150;
      expect(dragging.x).toBe(100);
      expect(dragging.y).toBe(150);
    });

    it('should track active bubble during drag', () => {
      dragging.active = 3;
      expect(dragging.active).toBe(3);
    });

    it('should track drag start position', () => {
      dragging.startX = 50;
      dragging.startY = 75;
      expect(dragging.startX).toBe(50);
      expect(dragging.startY).toBe(75);
    });
  });

  describe('CameraState', () => {
    beforeEach(() => {
      // Reset camera state
      editorCamera.x = 0;
      editorCamera.y = 0.1;
      editorCamera.scale = 2;
    });

    it('should have initial camera position', () => {
      expect(editorCamera.x).toBe(0);
      expect(editorCamera.y).toBe(0.1);
      expect(editorCamera.scale).toBe(2);
    });

    it('should allow panning camera', () => {
      editorCamera.x = -0.5;
      editorCamera.y = 0.3;
      expect(editorCamera.x).toBe(-0.5);
      expect(editorCamera.y).toBe(0.3);
    });

    it('should allow zooming camera', () => {
      editorCamera.scale = 4;
      expect(editorCamera.scale).toBe(4);
    });

    it('should handle negative scale (zoom out)', () => {
      editorCamera.scale = 0.5;
      expect(editorCamera.scale).toBe(0.5);
    });
  });
});

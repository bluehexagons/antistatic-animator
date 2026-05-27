import { describe, expect, it } from 'vitest';
import { UploadStorage } from '../storage/upload';

describe('UploadStorage', () => {
  it('loads only json and jsonc files', async () => {
    const storage = new UploadStorage();
    const count = await storage.loadFiles([
      new File(['{}'], 'carbon.json'),
      new File(['{}'], 'carbon_anim.jsonc'),
      new File(['not data'], 'notes.txt'),
    ]);

    expect(count).toBe(2);
    await expect(storage.list()).resolves.toEqual(['carbon.json', 'carbon_anim.jsonc']);
    await expect(storage.read('notes.txt')).rejects.toThrow(/file not loaded/);
  });
});

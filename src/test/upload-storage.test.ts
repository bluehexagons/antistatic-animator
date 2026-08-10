import { describe, expect, it, vi } from 'vitest';
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

  it('namespaces stage files uploaded from a repository folder', async () => {
    const stage = new File(['{}'], 'ruins.json');
    Object.defineProperty(stage, 'webkitRelativePath', {
      value: 'antistatic/app/assets/stages/ruins.json',
    });
    const storage = new UploadStorage();

    await storage.loadFiles([stage]);
    await expect(storage.list()).resolves.toEqual(['stages/ruins.json']);
    await expect(storage.read('stages/ruins.json')).resolves.toBe('{}');
  });

  it('keeps the previous upload when a new file cannot be read', async () => {
    const storage = new UploadStorage();
    await storage.loadFiles([new File(['{}'], 'carbon.json')]);
    const broken = new File(['broken'], 'new.json');
    vi.spyOn(broken, 'text').mockRejectedValue(new Error('read failed'));

    await expect(storage.loadFiles([broken])).rejects.toThrow('read failed');
    await expect(storage.list()).resolves.toEqual(['carbon.json']);
  });
});

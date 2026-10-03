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

  it('recognizes standalone JSONC stages after a browser download', async () => {
    const storage = new UploadStorage();
    const stage = '// stage note\n{"name":"Hazard Lab","scene":{"schemaVersion":2}}';
    await storage.loadFiles([
      new File([stage], 'hazardlab.jsonc'),
      new File(['{"name":"carbon"}'], 'carbon.json'),
      new File(['{"scene":{"keyframes":[]}}'], 'carbon_anim.json'),
    ]);
    await expect(storage.list()).resolves.toEqual([
      'stages/hazardlab.jsonc',
      'carbon.json',
      'carbon_anim.json',
    ]);
    await expect(storage.read('stages/hazardlab.jsonc')).resolves.toBe(stage);
  });

  it('keeps unsupported stage versions in the stage namespace for validation', async () => {
    const storage = new UploadStorage();
    await storage.loadFiles([
      new File(['{"name":"Future","scene":{"schemaVersion":99}}'], 'future.json'),
    ]);
    await expect(storage.list()).resolves.toEqual(['stages/future.json']);
  });

  it('rejects duplicate inferred stage names without replacing the current upload', async () => {
    const storage = new UploadStorage();
    await storage.loadFiles([new File(['{}'], 'carbon.json')]);
    const stage = '{"name":"Stage","scene":{"schemaVersion":2}}';
    await expect(
      storage.loadContents([
        { path: 'hazardlab.json', content: stage },
        { path: 'app/assets/stages/hazardlab.json', content: stage },
      ])
    ).rejects.toThrow('Duplicate uploaded file name: stages/hazardlab.json');
    await expect(storage.list()).resolves.toEqual(['carbon.json']);
  });

  it('loads bundled example contents using the same local backend', async () => {
    const storage = new UploadStorage();
    await storage.loadContents(
      [
        { path: 'app/characters/data/demo.json', content: '{"name":"demo"}' },
        { path: 'app/characters/data/demo_anim.json', content: '{}' },
        { path: 'app/assets/stages/demo.json', content: '{"name":"stage"}' },
      ],
      'Example: Demo'
    );

    await expect(storage.list()).resolves.toEqual([
      'demo.json',
      'demo_anim.json',
      'stages/demo.json',
    ]);
    expect(storage.label).toBe('Example: Demo');
  });

  it('keeps the previous upload when a new file cannot be read', async () => {
    const storage = new UploadStorage();
    await storage.loadFiles([new File(['{}'], 'carbon.json')]);
    const broken = new File(['broken'], 'new.json');
    vi.spyOn(broken, 'text').mockRejectedValue(new Error('read failed'));

    await expect(storage.loadFiles([broken])).rejects.toThrow('read failed');
    await expect(storage.list()).resolves.toEqual(['carbon.json']);
  });

  it('rejects duplicate basenames instead of silently replacing one', async () => {
    const storage = new UploadStorage();
    await expect(
      storage.loadContents([
        { path: 'first/app/characters/data/shared.json', content: 'first' },
        { path: 'second/app/characters/data/shared.json', content: 'second' },
      ])
    ).rejects.toThrow('Duplicate uploaded file name: shared.json');
  });
});

import * as fs from 'node:fs';
import { dirname } from 'node:path';

let atomicWriteSequence = 0;

export const writeFileAtomic = (filename: string, content: string): void => {
  const temporary = `${filename}.antistatic-animator-${Date.now()}-${process.pid}-${atomicWriteSequence++}.tmp`;
  fs.mkdirSync(dirname(filename), { recursive: true });
  const descriptor = fs.openSync(temporary, 'wx');
  try {
    try {
      fs.writeFileSync(descriptor, content, 'utf8');
      // Windows requires a writable handle to flush the temporary file.
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(temporary, filename);
  } catch (error) {
    try {
      fs.unlinkSync(temporary);
    } catch {
      // Preserve the original write/rename error.
    }
    throw error;
  }
};

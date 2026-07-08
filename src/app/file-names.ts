import { DATA_FILE_RE } from '../utils';

const ANIMATION_FILE_RE = /_anim\.jsonc?$/i;

export const isCharacterDataFile = (name: string): boolean =>
  DATA_FILE_RE.test(name) && !ANIMATION_FILE_RE.test(name);

export const stripDataExtension = (name: string): string => name.replace(DATA_FILE_RE, '');

export const animationFileCandidates = (characterFile: string): string[] => {
  const stem = stripDataExtension(characterFile);
  return [`${stem}_anim.json`, `${stem}_anim.jsonc`];
};

export const findAnimationFile = (
  characterFile: string,
  hasFile: (name: string) => boolean
): string =>
  animationFileCandidates(characterFile).find(hasFile) ?? animationFileCandidates(characterFile)[0];

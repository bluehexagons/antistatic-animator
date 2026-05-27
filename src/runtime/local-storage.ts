export const getLocalStorageItem = (key: string): string | undefined => {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
};

export const setLocalStorageItem = (key: string, value: string): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Non-persistent browser modes can deny localStorage. The app can still
    // run; it just cannot remember the previous source directory.
  }
};

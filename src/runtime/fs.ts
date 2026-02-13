// Use the exposed Node APIs from the preload script
// Lazy accessor to avoid import-time errors in non-Electron environments (e.g., tests)
let cachedFs: typeof window.nodeAPI.fs | null = null;

const getFs = () => {
  if (cachedFs) return cachedFs;
  if (!window.nodeAPI?.fs) {
    throw new Error('Node.js fs API is not available. Run this in Electron.');
  }
  cachedFs = window.nodeAPI.fs;
  return cachedFs;
};

// Export wrapped functions that call getFs() on demand
export default {
  get existsSync() {
    return getFs().existsSync;
  },
  get readdirSync() {
    return getFs().readdirSync;
  },
  get readFileSync() {
    return getFs().readFileSync;
  },
  get writeFileSync() {
    return getFs().writeFileSync;
  },
  get watch() {
    return getFs().watch;
  },
};

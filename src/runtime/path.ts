// Use the exposed Node APIs from the preload script
// Lazy accessor to avoid import-time errors in non-Electron environments (e.g., tests)
let cachedPath: typeof window.nodeAPI.path | null = null;

const getPath = () => {
  if (cachedPath) return cachedPath;
  if (!window.nodeAPI?.path) {
    throw new Error('Node.js path API is not available. Run this in Electron.');
  }
  cachedPath = window.nodeAPI.path;
  return cachedPath;
};

// Export wrapped functions that call getPath() on demand
export default {
  get resolve() {
    return getPath().resolve;
  },
  get join() {
    return getPath().join;
  },
  get dirname() {
    return getPath().dirname;
  },
  get basename() {
    return getPath().basename;
  },
  get extname() {
    return getPath().extname;
  },
};

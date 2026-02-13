// Use the exposed Node APIs from the preload script
// Lazy accessor to avoid import-time errors in non-Electron environments (e.g., tests)
const getPath = () => {
  if (!window.nodeAPI?.path) {
    throw new Error('Node.js path API is not available. Run this in Electron.');
  }
  return window.nodeAPI.path;
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

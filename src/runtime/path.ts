// Use the exposed Node APIs from the preload script
const path = window.nodeAPI?.path ?? (() => {
  // Fallback for non-Electron environments (shouldn't happen in production)
  throw new Error('Node.js path API is not available. Run this in Electron.');
})();

export default path;

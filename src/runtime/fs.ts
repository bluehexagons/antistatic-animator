// Use the exposed Node APIs from the preload script
const fs = window.nodeAPI?.fs ?? (() => {
  // Fallback for non-Electron environments (shouldn't happen in production)
  throw new Error('Node.js fs API is not available. Run this in Electron.');
})();

export default fs;

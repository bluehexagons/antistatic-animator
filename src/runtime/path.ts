// Use the exposed Node APIs from the preload script
const path = (() => {
  if (!window.nodeAPI?.path) {
    throw new Error('Node.js path API is not available. Run this in Electron.');
  }
  return window.nodeAPI.path;
})();

export default path;

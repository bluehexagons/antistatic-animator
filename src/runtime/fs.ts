// Use the exposed Node APIs from the preload script
const fs = (() => {
  if (!window.nodeAPI?.fs) {
    throw new Error('Node.js fs API is not available. Run this in Electron.');
  }
  return window.nodeAPI.fs;
})();

export default fs;

export const getRuntimeRequire = (name: string) => {
  const globalRequire = (globalThis as { require?: NodeRequire }).require ?? null
  const nodeRequire = typeof require === 'function' ? require : null
  const runtimeRequire = globalRequire || nodeRequire || null
  if (!runtimeRequire) {
    throw new Error(`${name} runtime require is unavailable; run this in an Electron or Node.js runtime`)
  }
  return runtimeRequire
}

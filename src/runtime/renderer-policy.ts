/** Only the bundled document (with optional in-document anchors) owns IPC. */
export function isApplicationUrl(candidate: string, applicationUrl: string): boolean {
  try {
    const url = new URL(candidate);
    url.hash = '';
    return url.href === applicationUrl;
  } catch {
    return false;
  }
}

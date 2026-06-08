/**
 * Immersive routes hide the mobile bottom nav and drop the bottom-nav content
 * clearance, so focused/compose screens get the full viewport. Shared by
 * MobileNav and AppMain so the two never disagree.
 */
export function isImmersiveRoute(pathname: string) {
  return pathname === "/workspace" || /^\/workspace\/.+/.test(pathname);
}

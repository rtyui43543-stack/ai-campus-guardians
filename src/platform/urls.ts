/** Resolve packaged assets inside this app's deployment directory, including GitHub project Pages. */
export function resolveAppAsset(path: string, base: string): string {
  if (!path || path.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(path)) throw new Error('素材必須位於遊戲資料夾內。');
  const url = new URL(path.replace(/^\//, ''), base);
  const scope = new URL(base);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) throw new Error('素材不在遊戲資料夾內。');
  return url.href;
}

export function appBaseUrl(): string {
  return new URL(import.meta.env.BASE_URL, document.baseURI).href;
}

export function appAssetUrl(path: string): string {
  return resolveAppAsset(path, appBaseUrl());
}

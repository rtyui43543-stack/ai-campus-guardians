/** Keep the nine-head silhouette visible when story close-ups pan toward either actor. */
export function fitNineHeadStoryCamera(viewWidth: number, viewHeight: number,
  requested: { x: number; y: number; zoom: number },
  actors: { heroX: number; enemyX: number; enemyLeft: number; enemyRight: number }, elevation: number) {
  const minX = Math.min(actors.heroX - 1.85, actors.enemyX - actors.enemyLeft);
  const maxX = Math.max(actors.heroX + 1.85, actors.enemyX + actors.enemyRight);
  // Bounds include the entire cover hero's hat/boots and the dragon's full image plane.
  const bottom = -.2, top = 4.05, usableFraction = .84;
  const zoom = Math.min(requested.zoom, viewWidth * usableFraction / (maxX - minX),
    viewHeight * usableFraction / (top - bottom));
  const halfWidth = viewWidth / (2 * zoom), halfHeight = viewHeight / (2 * zoom);
  const paddingX = halfWidth * (1 - usableFraction), paddingY = halfHeight * (1 - usableFraction);
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
  const cosPitch = 15 / Math.hypot(15, elevation);
  return {
    x: clamp(requested.x, maxX - halfWidth + paddingX, minX + halfWidth - paddingX),
    y: clamp(requested.y * cosPitch, top - halfHeight + paddingY, bottom + halfHeight - paddingY) / cosPitch,
    zoom,
  };
}

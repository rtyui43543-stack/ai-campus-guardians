/** Older Android Chrome ignores dvh. Use its actual content viewport instead of
 * the screen's largest vh, so browser bars and rotation cannot leave a blank
 * area or push the battle's controls below the screen. Modern browsers keep
 * their native dynamic viewport behavior. */
export function installLegacyViewportHeight(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined'
    || typeof CSS !== 'undefined' && CSS.supports('height', '100dvh')) return () => {};

  const style = document.documentElement.style;
  const name = '--legacy-viewport-height';
  const previous = style.getPropertyValue(name);
  let frame = 0;
  let stopped = false;
  const update = () => {
    frame = 0;
    if (!stopped && Number.isFinite(window.innerHeight) && window.innerHeight > 0)
      style.setProperty(name, `${Math.round(window.innerHeight)}px`);
  };
  const schedule = () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };
  update();
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.addEventListener('pageshow', schedule);
  return () => {
    stopped = true;
    window.removeEventListener('resize', schedule);
    window.removeEventListener('orientationchange', schedule);
    window.removeEventListener('pageshow', schedule);
    if (frame) window.cancelAnimationFrame(frame);
    if (previous) style.setProperty(name, previous);
    else style.removeProperty(name);
  };
}

export type Screen = 'cover' | 'map' | 'battle' | 'results' | 'growth' | 'proposals' | 'settings';

/** The app root is the title screen; explicit links still restore their destination. */
export function screenFromHash(hash: string, saved: { battle: boolean; results: boolean }): Screen {
  switch (hash) {
    case '#map': return 'map';
    case '#battle': return saved.battle ? 'battle' : 'cover';
    case '#results': return saved.results ? 'results' : 'cover';
    case '#growth': return 'growth';
    case '#proposals': return 'proposals';
    case '#settings': return 'settings';
    default: return 'cover';
  }
}

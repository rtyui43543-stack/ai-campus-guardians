import { appAssetUrl } from '../platform/urls';
import './association-brand.css';

/** Preserve the supplied association lockup as one outlined vector image. */
export function AssociationBrand({ placement }: { placement: 'cover' | 'main' }) {
  return <div className={'association-brand association-brand-' + placement}>
    <img src={appAssetUrl('/brand/taiwan-campus-ai-education-association.svg')}
      alt="台灣校園人工智慧教育協會 Taiwan Campus Artificial Intelligence Education Association"
      width={489} height={102} decoding="async" />
  </div>;
}

import { Fragment } from 'react';
import credits from '../content/musicCredits.json';
import './music-credits.css';

export function MusicCredits() {
  return <details className="music-credits">
    <summary>音樂來源</summary>
    <div className="music-credits-body">
      <p>音樂：<a href={credits.creatorUrl} target="_blank" rel="noreferrer">{credits.creator}</a></p>
      <p>{credits.tracks.map((track, index) => <Fragment key={track.file}>
        {index > 0 && '、'}<a href={track.source} target="_blank" rel="noreferrer">{track.title}</a>
      </Fragment>)}</p>
      <p>授權：<a href={credits.licenseUrl} target="_blank" rel="noreferrer">{credits.license}</a> · 原曲未修改</p>
    </div>
  </details>;
}

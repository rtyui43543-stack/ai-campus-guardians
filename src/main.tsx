import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/noto-sans-tc';
import { App } from './App';
import './styles.css';
import './evidence.css';
import './accessibility.css';
import './combat.css';
import './readability.css';
import './mobile-battle.css';
import './duel.css';
import './offline-download.css';
import './audio-controls.css';
import './defeat.css';
import './score.css';
import './student-readability.css';
import './magic-campus-theme.css';
import './styles/cover-world.css';
import './styles/battle-mechanics.css';
import './styles/growth-dashboard.css';
import './styles/battle-layout.css';
import './styles/battle-readability.css';
import { installLegacyViewportHeight } from './platform/legacyViewport';

const stopLegacyViewport = installLegacyViewportHeight();
if (import.meta.hot) import.meta.hot.dispose(stopLegacyViewport);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);

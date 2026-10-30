import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
// Polices embarquées dans l'app : la salle de réception n'a pas forcément internet.
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/archivo/wdth.css';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

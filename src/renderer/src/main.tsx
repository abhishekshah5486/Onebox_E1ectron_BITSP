import '@cloudscape-design/global-styles/index.css';
import './theme/tokens.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './theme/ThemeProvider';
import { UiVersionProvider } from './theme/UiVersionProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <UiVersionProvider>
        <App />
      </UiVersionProvider>
    </ThemeProvider>
  </StrictMode>,
);

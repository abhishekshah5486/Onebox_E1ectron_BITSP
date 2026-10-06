import '@cloudscape-design/global-styles/index.css';
import './theme/tokens.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyCloudscapeTheme } from './theme/cloudscape-theme';
import { ThemeProvider } from './theme/ThemeProvider';

applyCloudscapeTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);

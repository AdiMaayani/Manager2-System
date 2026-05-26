import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import './styles/utilities.css';
import '@shared/layout/layout.css';
import './styles/frappe-gantt.css';
import { App } from './app/App';

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

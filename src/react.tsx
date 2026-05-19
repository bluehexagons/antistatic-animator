import { createRoot } from 'react-dom/client';
import { App } from './app/App';

import './styles.css';

const container = document.getElementById('main');
if (!container) {
  throw new Error('mount point #main not found');
}
const root = createRoot(container);
root.render(<App />);

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {SupabaseProvider} from './contexts/SupabaseContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <SupabaseProvider>
    <App />
  </SupabaseProvider>
);

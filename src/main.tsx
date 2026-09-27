import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import './index.css';
import App from './App.tsx';
import { store } from './store';
import { useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';

function AppWithAuthInit() {
  const { init } = useAuth();

  useEffect(() => {
    init();
  }, [init]);

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <BrowserRouter>
          <AppWithAuthInit />
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  </StrictMode>,
);

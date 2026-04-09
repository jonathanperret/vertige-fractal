import { ThemeProvider } from '@material-ui/core';
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import SettingsProvider, { SettingsContext } from './components/settings/SettingsContext';
import './index.css';
import theme from './theme/theme';

ReactDOM.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <SettingsProvider>
        <SettingsContext.Consumer>
          {({ settings }) => <App settings={settings} />}
        </SettingsContext.Consumer>
      </SettingsProvider>
    </ThemeProvider>
  </React.StrictMode>,
  document.getElementById('root'),
);
// by the ServiceWorkerWrapper (ServiceWorkerWrapper.tsx)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
// serviceWorker.register();

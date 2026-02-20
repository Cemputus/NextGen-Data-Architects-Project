import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './index.css';
import App from './App';

// In dev, call backend directly so User Management never 404s. CORS allows localhost:3000 -> 127.0.0.1:5000.
// Set REACT_APP_API_URL in .env to override (e.g. empty string to use proxy).
axios.defaults.baseURL =
  process.env.REACT_APP_API_URL !== undefined
    ? process.env.REACT_APP_API_URL
    : process.env.NODE_ENV === 'development'
      ? 'http://127.0.0.1:5000'
      : '';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);





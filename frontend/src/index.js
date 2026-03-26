import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './index.css';
import App from './App';

// API base URL policy:
// - Development: default direct backend (127.0.0.1:5000), can be overridden by REACT_APP_API_URL.
// - Production: default relative '/api' calls (same-origin). This avoids browser CORS preflights
//   when deployed on Vercel with API rewrites.
// - If you explicitly need absolute cross-origin API in production, set REACT_APP_FORCE_ABSOLUTE_API=1.
const forceAbsoluteApi = String(process.env.REACT_APP_FORCE_ABSOLUTE_API || '').trim() === '1';
const envApiUrl = process.env.REACT_APP_API_URL;
if (process.env.NODE_ENV === 'development') {
  axios.defaults.baseURL = envApiUrl !== undefined ? envApiUrl : 'http://127.0.0.1:5000';
} else {
  axios.defaults.baseURL = forceAbsoluteApi ? (envApiUrl || '') : '';
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);





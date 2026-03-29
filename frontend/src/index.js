import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './index.css';
import App from './App';

// API base URL policy (see docs/deployment/PRODUCTION_URLS_AND_SESSIONS.md)
// - Development: default http://127.0.0.1:5000, or REACT_APP_API_URL if set.
// - Production (e.g. Vercel → Render): if REACT_APP_API_URL is set (https://nextgen-mis.onrender.com),
//   axios calls the API directly; backend CORS must allow https://nextgen-mis.vercel.app (default in app.py).
// - If REACT_APP_API_URL is unset, use same-origin /api (Vercel rewrites in vercel.json).
const envApiUrlRaw = process.env.REACT_APP_API_URL;
const envApiUrl = typeof envApiUrlRaw === 'string' ? envApiUrlRaw.trim().replace(/\/$/, '') : '';
if (process.env.NODE_ENV === 'development') {
  axios.defaults.baseURL = envApiUrl || 'http://127.0.0.1:5000';
} else {
  axios.defaults.baseURL = envApiUrl || '';
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);





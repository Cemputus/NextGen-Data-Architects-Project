import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './index.css';
import App from './App';

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

// Centralised API / WebSocket URLs (CRA uses REACT_APP_ prefix)
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://syncline-1.onrender.com/api';
export const API_ORIGIN   = API_BASE_URL.replace(/\/api\/?$/, '');
export const WS_URL       = process.env.REACT_APP_WS_URL || 'wss://syncline-1.onrender.com/ws';

// API configuration that works for both localhost and cross-device access
const getApiBaseUrl = () => {
  // If we're in development and accessing via localhost, use localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001/api';
  }

  // Otherwise, use the same host that served the frontend (your MacBook's IP)
  // This will work when accessing from other devices on the same network
  return `http://${window.location.hostname}:3001/api`;
};

export const API_BASE_URL = getApiBaseUrl();
export default API_BASE_URL;
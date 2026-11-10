import axios from 'axios';
import { toast } from 'react-hot-toast';

export const getApiBaseUrl = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl && String(envUrl).trim()) {
        return String(envUrl).trim().replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined' && window.location?.hostname) {
        const { protocol, hostname, port } = window.location;
        if (port === '5173' || hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            return `${protocol === 'https:' ? 'https:' : 'http:'}//${hostname}:5000/api`;
        }
        return '/api';
    }
    return 'http://localhost:5000/api';
};

export const getBackendOrigin = () => {
    const apiBase = getApiBaseUrl();
    if (apiBase === '/api' && typeof window !== 'undefined') {
        return window.location.origin;
    }
    return apiBase.replace(/\/api\/?$/, '');
};

export const getFileUrl = (filePath) => {
    if (!filePath) return '';
    const str = String(filePath).trim();
    if (!str) return '';
    if (/^(https?:|data:|blob:)/i.test(str)) return str;
    const normalized = str.startsWith('/') ? str : `/${str}`;
    return `${getBackendOrigin()}${normalized}`;
};

export const extractApiError = (error, fallback = 'Something went wrong') => {
    return error?.response?.data?.message || error?.message || fallback;
};

const api = axios.create({
    baseURL: getApiBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to every request
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Handle auth expiry & network failures without stacking duplicate error toasts
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;
        const reqUrl = String(error?.config?.url || '');
        const isAuthEndpoint = reqUrl.includes('/auth/login') || reqUrl.includes('/auth/change-password');

        if (status === 401 && !isAuthEndpoint) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('permissions');
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('nkd-auth-expired'));
            }
            toast.error('Session expired. Please sign in again.', { id: 'session-expired' });
        } else if (!error?.response) {
            toast.error('Unable to reach server. Please check connection.', { id: 'network-error' });
        }

        return Promise.reject(error);
    }
);

export default api;

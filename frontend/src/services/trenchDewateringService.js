import api, { getApiBaseUrl } from './api';

const trenchDewateringService = {
    getLogs: (params = {}) => api.get('/dpr/trench-logs', { params }),
    getStats: (params = {}) => api.get('/dpr/trench-logs/stats', { params }),
    createLog: (data) => api.post('/dpr/trench-logs', data),
    updateLog: (id, data) => api.put(`/dpr/trench-logs/${id}`, data),
    deleteLog: (id) => api.delete(`/dpr/trench-logs/${id}`),

    getExportPdfUrl: (params = {}) => {
        const token = localStorage.getItem('token');
        const cleanParams = Object.fromEntries(
            Object.entries({ ...params, token: token || '' }).filter(([, v]) => v !== undefined && v !== null && v !== '')
        );
        const query = new URLSearchParams(cleanParams).toString();
        return `${getApiBaseUrl()}/dpr/trench-logs/export-pdf?${query}`;
    }
};

export default trenchDewateringService;


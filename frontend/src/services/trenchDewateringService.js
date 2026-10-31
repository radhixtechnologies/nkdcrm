import api from './api';

const trenchDewateringService = {
    getLogs: (params = {}) => api.get('/dpr/trench-logs', { params }),
    getStats: (params = {}) => api.get('/dpr/trench-logs/stats', { params }),
    createLog: (data) => api.post('/dpr/trench-logs', data),
    updateLog: (id, data) => api.put(`/dpr/trench-logs/${id}`, data),
    deleteLog: (id) => api.delete(`/dpr/trench-logs/${id}`),
    
    getExportPdfUrl: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        const baseURL = api.defaults.baseURL || '/api';
        return `${baseURL}/dpr/trench-logs/export-pdf?${query}`;
    }
};

export default trenchDewateringService;


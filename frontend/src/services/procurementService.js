import api, { getApiBaseUrl } from './api';

const procurementService = {
    getAllItems: (params = {}) => api.get('/procurement', { params }),
    getStats: (params = {}) => api.get('/procurement/stats', { params }),
    createItem: (data) => api.post('/procurement', data),
    updateItem: (id, data) => api.put(`/procurement/${id}`, data),
    deleteItem: (id) => api.delete(`/procurement/${id}`),

    getExportPdfUrl: (params = {}) => {
        const token = localStorage.getItem('token');
        const cleanParams = Object.fromEntries(
            Object.entries({ ...params, token: token || '' }).filter(([, v]) => v !== undefined && v !== null && v !== '')
        );
        const query = new URLSearchParams(cleanParams).toString();
        return `${getApiBaseUrl()}/procurement/export-pdf?${query}`;
    }
};

export default procurementService;


import api from './api';

const procurementService = {
    getAllItems: (params = {}) => api.get('/procurement', { params }),
    getStats: (params = {}) => api.get('/procurement/stats', { params }),
    createItem: (data) => api.post('/procurement', data),
    updateItem: (id, data) => api.put(`/procurement/${id}`, data),
    deleteItem: (id) => api.delete(`/procurement/${id}`),

    getExportPdfUrl: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        const baseURL = api.defaults.baseURL || '/api';
        return `${baseURL}/procurement/export-pdf?${query}`;
    }
};

export default procurementService;


import api from './api';

const dprService = {
    getAllDprs: (params) => api.get('/dpr', { params }),
    getDprById: (id) => api.get(`/dpr/${id}`),
    createDpr: (data) => api.post('/dpr', data),
    updateDpr: (id, data) => api.put(`/dpr/${id}`, data),
    deleteDpr: (id) => api.delete(`/dpr/${id}`),
    getPdfUrl: (id) => {
        const token = localStorage.getItem('token');
        return `${api.defaults.baseURL || ''}/api/dpr/${id}/pdf?token=${encodeURIComponent(token || '')}`;
    }
};

export default dprService;

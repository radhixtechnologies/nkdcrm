import api from './api';

const siteService = {
    getAllSites: () => api.get('/sites'),
    createSite: (data) => api.post('/sites', data),
    updateSite: (id, data) => api.put(`/sites/${id}`, data),
    deleteSite: (id) => api.delete(`/sites/${id}`),
};

export default siteService;

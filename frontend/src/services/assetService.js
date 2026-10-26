import api from './api';

const assetService = {
    getAssets: (params) => api.get('/assets', { params }),
    getAssetStats: () => api.get('/assets/stats'),
    createAsset: (data) => api.post('/assets', data),
    updateAsset: (id, data) => api.put(`/assets/${id}`, data),
    deleteAsset: (id) => api.delete(`/assets/${id}`),

    getAllocations: (params) => api.get('/assets/allocations', { params }),
    allocateAsset: (data) => api.post('/assets/allocate', data),
    returnAsset: (id, data) => api.post(`/assets/return/${id}`, data),
};

export default assetService;


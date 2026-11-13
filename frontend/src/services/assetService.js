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

    getHandoverFormUrl: (allocationId) => {
        const token = localStorage.getItem('token');
        return `/api/assets/allocations/${allocationId}/handover-form?token=${encodeURIComponent(token || '')}`;
    },
    downloadHandoverForm: async (allocationId, assetName = 'Asset') => {
        const res = await api.get(`/assets/allocations/${allocationId}/handover-form`, { responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `IT_Asset_Handover_Form_${String(assetName).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }
};

export default assetService;


import api from './api';

const vendorService = {
    getVendors: (params) => api.get('/vendors', { params }),
    getVendorStats: () => api.get('/vendors/stats'),
    createVendor: (data) => api.post('/vendors', data),
    updateVendor: (id, data) => api.put(`/vendors/${id}`, data),
    deleteVendor: (id) => api.delete(`/vendors/${id}`),

    getAgreements: (vendorId) => api.get('/vendors/agreements', { params: { vendor_id: vendorId } }),
    createAgreement: (data) => api.post('/vendors/agreements', data),
    deleteAgreement: (id) => api.delete(`/vendors/agreements/${id}`),
};

export default vendorService;

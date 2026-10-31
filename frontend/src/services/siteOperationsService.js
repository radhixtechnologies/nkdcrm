import api from './api';

const siteOperationsService = {
    // Stats Overview
    getStats: (site_id = 'ALL') => api.get('/site-operations/stats', { params: { site_id } }),

    // Concerns / Issue Reporting
    getConcerns: (params = {}) => api.get('/site-operations/concerns', { params }),
    createConcern: (data) => api.post('/site-operations/concerns', data),
    updateConcern: (id, data) => api.put(`/site-operations/concerns/${id}`, data),
    deleteConcern: (id) => api.delete(`/site-operations/concerns/${id}`),

    // Measurement Sheets (M-Book)
    getMeasurements: (params = {}) => api.get('/site-operations/measurements', { params }),
    createMeasurement: (data) => api.post('/site-operations/measurements', data),
    updateMeasurement: (id, data) => api.put(`/site-operations/measurements/${id}`, data),
    deleteMeasurement: (id) => api.delete(`/site-operations/measurements/${id}`),

    // Vendor Mapping & Scope
    getVendors: (params = {}) => api.get('/site-operations/vendors', { params }),
    updateVendor: (id, data) => api.put(`/site-operations/vendors/${id}`, data),

    // Tools & Tackles / TPI Register
    getTools: (params = {}) => api.get('/site-operations/tools', { params }),
    createTool: (data) => api.post('/site-operations/tools', data),
    updateTool: (id, data) => api.put(`/site-operations/tools/${id}`, data),
    deleteTool: (id) => api.delete(`/site-operations/tools/${id}`),
    uploadCertificate: (formData) => api.post('/site-operations/tools/upload-certificate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
};

export default siteOperationsService;


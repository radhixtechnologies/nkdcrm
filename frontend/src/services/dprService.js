import api, { getApiBaseUrl } from './api';

const dprService = {
    getAllDprs: (params) => api.get('/dpr', { params }),
    getDprById: (id) => api.get(`/dpr/${id}`),
    createDpr: (data) => api.post('/dpr', data),
    updateDpr: (id, data) => api.put(`/dpr/${id}`, data),
    deleteDpr: (id) => api.delete(`/dpr/${id}`),
    getSiteTemplate: (siteId) => api.get(`/dpr/template/${siteId}`),
    getSiteWiseArchive: (siteId) => api.get('/dpr/archive/site-wise', {
        params: siteId && siteId !== 'ALL' ? { site_id: siteId } : {}
    }),
    uploadPhoto: (formData) => api.post('/dpr/upload-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    getPdfUrl: (id) => {
        const token = localStorage.getItem('token');
        return `${getApiBaseUrl()}/dpr/${id}/pdf?token=${encodeURIComponent(token || '')}`;
    },
    getExcelUrl: (id) => {
        const token = localStorage.getItem('token');
        return `${getApiBaseUrl()}/dpr/${id}/excel?token=${encodeURIComponent(token || '')}`;
    },
    downloadExcel: async (id, filename = 'DPR_Report.xlsx') => {
        const res = await api.get(`/dpr/${id}/excel`, { responseType: 'blob' });
        const blob = new Blob([res.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }
};

export default dprService;

import api from './api';

const invoiceService = {
    // Clients
    getClients: () => api.get('/clients'),
    createClient: (data) => api.post('/clients', data),
    updateClient: (id, data) => api.put(`/clients/${id}`, data),

    // Invoices
    getInvoices: (params) => api.get('/invoices', { params }),
    createInvoice: (data) => api.post('/invoices', data),
    updateInvoice: (id, data) => api.put(`/invoices/${id}`, data),
    deleteInvoice: (id) => api.delete(`/invoices/${id}`),
    updateInvoiceStatus: (id, status, payment_mode) => api.put(`/invoices/${id}/status`, { status, payment_mode }),
    recordPayment: (id, data) => api.post(`/invoices/${id}/payment`, data),
    getInvoiceStats: () => api.get('/invoices/stats'),
    downloadExcel: (params = {}) => {
        const token = localStorage.getItem('token');
        let query = token ? `token=${encodeURIComponent(token)}` : '';
        if (params.status && params.status !== 'ALL') query += `&status=${encodeURIComponent(params.status)}`;
        if (params.clientId) query += `&clientId=${encodeURIComponent(params.clientId)}`;
        const base = import.meta.env.VITE_API_URL || '/api/v1';
        window.open(`${base}/invoices/export/excel?${query}`, '_blank');
    },

    // Compliance Alerts
    getComplianceAlerts: () => api.get('/compliance/alerts')
};

export default invoiceService;


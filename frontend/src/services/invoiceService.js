import api from './api';

const invoiceService = {
    // Clients
    getClients: () => api.get('/clients'),
    createClient: (data) => api.post('/clients', data),
    updateClient: (id, data) => api.put(`/clients/${id}`, data),

    // Invoices
    getInvoices: (params) => api.get('/invoices', { params }),
    createInvoice: (data) => api.post('/invoices', data),
    updateInvoiceStatus: (id, status, payment_mode) => api.put(`/invoices/${id}/status`, { status, payment_mode }),
    getInvoiceStats: () => api.get('/invoices/stats'),

    // Compliance Alerts
    getComplianceAlerts: () => api.get('/compliance/alerts')
};

export default invoiceService;


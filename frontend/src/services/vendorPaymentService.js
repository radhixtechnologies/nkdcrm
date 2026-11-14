import api from './api';

const vendorPaymentService = {
    getStats: () => api.get('/vendor-payments/stats'),
    getInvoices: (params) => api.get('/vendor-payments/invoices', { params }),
    getInvoiceById: (id) => api.get(`/vendor-payments/invoices/${id}`),
    createInvoice: (data) => api.post('/vendor-payments/invoices', data),
    updateInvoice: (id, data) => api.put(`/vendor-payments/invoices/${id}`, data),
    deleteInvoice: (id) => api.delete(`/vendor-payments/invoices/${id}`),
    recordPayment: (invoiceId, data) => api.post(`/vendor-payments/invoices/${invoiceId}/payments`, data),
    exportExcel: () => api.get('/vendor-payments/export/excel', { responseType: 'blob' })
};

export default vendorPaymentService;

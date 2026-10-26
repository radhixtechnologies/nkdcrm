import api from './api';

const payrollService = {
    // Generate Payroll (Trigger calculation)
    generatePayroll: (month, year) => api.post('/payroll/generate', { month, year }),

    // Get Payroll List
    getPayrollList: (month, year) => api.get(`/payroll/list?month=${month}&year=${year}`),

    // Finalize Payroll
    finalizePayroll: (payrollIds) => api.post('/payroll/finalize', { payroll_ids: payrollIds }),

    // Get Config
    getConfig: () => api.get('/payroll/config'),

    // Get My Payroll (Employee Self-Service)
    getMyPayrollHistory: (year) => api.get(`/payroll/my-history`, { params: { year } }),

    // Export
    downloadPayslip: (id) => {
        const token = localStorage.getItem('token');
        window.open(`${api.defaults.baseURL}/payroll/payslip/${id}/pdf?token=${token}`, '_blank');
    },
    downloadExcel: (month, year) => {
        const token = localStorage.getItem('token');
        window.open(`${api.defaults.baseURL}/payroll/export/excel?month=${month}&year=${year}&token=${token}`, '_blank');
    },

    // Get Single Payroll Detail
    getPayrollDetail: (id) => api.get(`/payroll/${id}`),
};

export default payrollService;

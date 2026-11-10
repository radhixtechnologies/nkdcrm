import api, { getApiBaseUrl } from './api';
import { toast } from 'react-hot-toast';

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
        if (!token) {
            toast.error('Please sign in again to download payslip');
            return;
        }
        window.open(`${getApiBaseUrl()}/payroll/payslip/${id}/pdf?token=${encodeURIComponent(token)}`, '_blank', 'noopener,noreferrer');
    },
    downloadExcel: (month, year) => {
        const token = localStorage.getItem('token');
        if (!token) {
            toast.error('Please sign in again to export payroll');
            return;
        }
        window.open(`${getApiBaseUrl()}/payroll/export/excel?month=${month}&year=${year}&token=${encodeURIComponent(token)}`, '_blank', 'noopener,noreferrer');
    },

    // Get Single Payroll Detail
    getPayrollDetail: (id) => api.get(`/payroll/${id}`),
};

export default payrollService;

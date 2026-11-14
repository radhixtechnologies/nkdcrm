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
    downloadClientWageSheet: (month, year, siteId = null) => {
        const token = localStorage.getItem('token');
        if (!token) {
            toast.error('Please sign in again to export wage sheet');
            return;
        }
        let url = `${getApiBaseUrl()}/payroll/export/client-wage-sheet?month=${month}&year=${year}&token=${encodeURIComponent(token)}`;
        if (siteId) url += `&site_id=${siteId}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    },
    downloadBankNeft: (month, year, siteId = null) => {
        const token = localStorage.getItem('token');
        if (!token) {
            toast.error('Please sign in again to export bank NEFT file');
            return;
        }
        let url = `${getApiBaseUrl()}/payroll/export/bank-neft?month=${month}&year=${year}&token=${encodeURIComponent(token)}`;
        if (siteId) url += `&site_id=${siteId}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    },

    // Get Single Payroll Detail
    getPayrollDetail: (id) => api.get(`/payroll/${id}`),
};

export default payrollService;

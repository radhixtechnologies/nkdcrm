import api, { getApiBaseUrl } from './api';
import toast from 'react-hot-toast';

const employeeService = {
    getEmployees: (params) => api.get('/employees', { params }),
    createEmployee: (data) => api.post('/employees', data),
    updateEmployee: (id, data) => api.put(`/employees/${id}`, data),
    getEmployeeById: (id) => api.get(`/employees/${id}`),
    getMyProfile: () => api.get('/employees/profile/me'),
    updateMyProfile: (data) => api.put('/employees/profile/update', data),
    changePassword: (data) => api.post('/auth/change-password', data),
    deleteEmployee: (id) => api.delete(`/employees/${id}`),
    getOshAppointmentLetterUrl: (id) => {
        const token = localStorage.getItem('token');
        return `${getApiBaseUrl()}/employees/${id}/osh-appointment-letter?token=${encodeURIComponent(token || '')}`;
    },
    downloadOshAppointmentLetter: async (id, empCode = 'WORKER') => {
        const res = await api.get(`/employees/${id}/osh-appointment-letter`, { responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Appointment_Letter_OSH_Annexure_I_${empCode}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },
    getIntegrityAgreementUrl: (id) => {
        const token = localStorage.getItem('token');
        return `${getApiBaseUrl()}/employees/${id}/integrity-agreement?token=${encodeURIComponent(token || '')}`;
    },
    downloadIntegrityAgreement: async (id, empCode = 'WORKER') => {
        const res = await api.get(`/employees/${id}/integrity-agreement`, { responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Integrity_Confidentiality_Agreement_${empCode}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },
    getStaffJoiningLetterUrl: (id) => {
        const token = localStorage.getItem('token');
        return `${getApiBaseUrl()}/employees/${id}/staff-joining-letter?token=${encodeURIComponent(token || '')}`;
    },
    downloadStaffJoiningLetter: async (id, empCode = 'STAFF') => {
        const res = await api.get(`/employees/${id}/staff-joining-letter`, { responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Joining_Letter_${empCode}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },
    getAssetHandoverFormUrl: (id) => {
        const token = localStorage.getItem('token');
        return `${getApiBaseUrl()}/employees/${id}/asset-handover-form?token=${encodeURIComponent(token || '')}`;
    },
    downloadAssetHandoverForm: async (id, empCode = 'STAFF') => {
        const res = await api.get(`/employees/${id}/asset-handover-form`, { responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `IT_Asset_Handover_Form_${empCode}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },
    getSalaryStructureUrl: (id) => {
        const token = localStorage.getItem('token');
        return `${getApiBaseUrl()}/employees/${id}/salary-structure-pdf?token=${encodeURIComponent(token || '')}`;
    },
    downloadSalaryStructure: async (id, empCode = 'EMP') => {
        try {
            const res = await api.get(`/employees/${id}/salary-structure-pdf`, { responseType: 'blob' });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Salary_Structure_${empCode}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success(`Salary Structure for ${empCode} downloaded`);
        } catch (err) {
            toast.error('Failed to download salary structure PDF');
        }
    },
    downloadFnfSettlement: async (id, empCode = 'EMP') => {
        try {
            const res = await api.get(`/employees/${id}/fnf-settlement-pdf`, { responseType: 'blob' });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `FF_Settlement_${empCode}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success(`F&F Settlement for ${empCode} downloaded`);
        } catch (err) {
            toast.error('No F&F settlement statement generated for this employee yet.');
        }
    }
};

export default employeeService;

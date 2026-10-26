import api from './api';

const leaveService = {
    getAllLeaveTypes: () => api.get('/leaves/types'),
    getLeaveTypes: () => api.get('/leaves/types'),

    // Expects employee_code or id
    getEmployeeBalances: (code, year) => api.get(`/leaves/balance/${code}`, { params: { year } }),
    getBalances: (code, year) => api.get(`/leaves/balance/${code}`, { params: { year } }),
    getLeaveBalances: (code, year) => api.get(`/leaves/balance/${code}`, { params: { year } }),

    applyLeave: (data) => api.post('/leaves/apply', data),

    // Expects employee_code
    getMyLeaveHistory: (code) => api.get(`/leaves/history/${code}`),

    getPendingRequests: () => api.get('/leaves/pending'),
    getAllRequests: (params) => api.get('/leaves/all-requests', { params }),

    // Approval/Rejection uses POST and ID (request_id)
    approveLeave: (id, approverCode) => api.post(`/leaves/${id}/approve`, { approved_by_code: approverCode }),

    rejectLeave: (id, approverCode, reason) => api.post(`/leaves/${id}/reject`, { approved_by_code: approverCode, rejection_reason: reason }),

    // Initialize - Backend currently supports per-employee. 
    // If we need bulk, we need backend update. For now mapping to single usage or error.
    // Let's assume frontend calls this loop or backend adds bulk.
    // Keeping as placeholder or null if not used frequently.
    initializeBalances: (employeeCode, year) => api.post(`/leaves/balance/${employeeCode}/initialize`, { year }),
};

export default leaveService;

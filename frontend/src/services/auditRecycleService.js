import api from './api';

const auditRecycleService = {
    // Audit Logs
    getAuditLogs: (params = {}) => api.get('/audit-logs', { params }),
    getAuditStats: () => api.get('/audit-logs/stats'),
    getRecentAudit: (limit = 10) => api.get('/audit-logs/recent', { params: { limit } }),

    // Recycle Bin
    getRecycleBinItems: (params = {}) => api.get('/recycle-bin', { params }),
    getRecycleBinStats: () => api.get('/recycle-bin/stats'),
    restoreItem: (binId) => api.post(`/recycle-bin/${binId}/restore`),
    permanentDeleteItem: (binId) => api.delete(`/recycle-bin/${binId}/permanent`)
};

export default auditRecycleService;

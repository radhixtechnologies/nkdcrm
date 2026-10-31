import api from './api';

const recruitmentService = {
    // Requisitions
    getRequisitions: () => api.get('/recruitment/requisitions'),
    createRequisition: (data) => api.post('/recruitment/requisitions', data),
    updateRequisition: (id, data) => api.put(`/recruitment/requisitions/${id}`, data),

    // Candidates
    getCandidates: (params) => api.get('/recruitment/candidates', { params }),
    createCandidate: (data) => api.post('/recruitment/candidates', data),
    updateCandidateStage: (id, data) => api.put(`/recruitment/candidates/${id}/stage`, data),

    // Offer Letters & 10-Step Workflow
    getOffers: () => api.get('/recruitment/offers'),
    createOffer: (data) => api.post('/recruitment/offers', data),
    updateOfferStatus: (id, status) => api.put(`/recruitment/offers/${id}/status`, { status }),
    approveSalary: (id, data = {}) => api.post(`/recruitment/offers/${id}/approve-salary`, data),
    approveManagement: (id, data = {}) => api.post(`/recruitment/offers/${id}/approve-management`, data),
    dispatchEmail: (id) => api.post(`/recruitment/offers/${id}/dispatch-email`),
    acceptOffer: (id) => api.post(`/recruitment/offers/${id}/accept`),
    updateCandidateDocuments: (candidateId, data) => api.put(`/recruitment/candidates/${candidateId}/documents`, data),
    getAppointmentLetterPdfUrl: (offerId) => {
        const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
        const base = api.defaults.baseURL || '/api';
        return `${base}/recruitment/offers/${offerId}/pdf${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    },

    // 1-Click Convert to Employee
    convertToEmployee: (candidateId, data = {}) => api.post(`/recruitment/candidates/${candidateId}/convert-to-employee`, data)
};

export default recruitmentService;


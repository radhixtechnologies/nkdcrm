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

    // Offer Letters
    getOffers: () => api.get('/recruitment/offers'),
    createOffer: (data) => api.post('/recruitment/offers', data),
    updateOfferStatus: (id, status) => api.put(`/recruitment/offers/${id}/status`, { status }),

    // 1-Click Convert to Employee
    convertToEmployee: (candidateId, data = {}) => api.post(`/recruitment/candidates/${candidateId}/convert-to-employee`, data)
};

export default recruitmentService;


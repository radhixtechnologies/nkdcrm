import api from './api';

const benefitService = {
    // === Benefits Management ===

    // 1. Get Benefit Types
    getTypes: () => api.get('/benefits/types'),

    // 2. Assign Benefit (HR)
    assignBenefit: (data) => api.post('/benefits/assign', data),

    // 3. Get My Benefits
    getMyBenefits: (employeeCode) => api.get(`/benefits/my-benefits/${employeeCode}`),

    // === Claims & Reimbursements ===

    // 4. Apply Reimbursement (Updated Path)
    applyClaim: (data) => api.post('/reimbursements/apply', data),

    // 5. Get My Claims (Updated Path)
    getMyClaims: (employeeCode) => api.get(`/reimbursements/my/${employeeCode}`),

    // 6. Get Pending Claims (HR - Updated Path)
    getPendingClaims: () => api.get('/reimbursements/pending'),

    // 7. Approve Claim (HR - New Strict Path)
    approveClaim: (data) => api.post('/reimbursements/approve', data),

    // 8. Reject Claim (HR - New Strict Path)
    rejectClaim: (data) => api.post('/reimbursements/reject', data),

    // 9. Mark Paid (Finance - New Strict Path)
    markAsPaid: (data) => api.post('/reimbursements/mark-paid', data),

    // 10. Get All Claims (HR - New Path)
    getAllClaims: (status) => api.get(`/reimbursements/all${status ? `?status=${status}` : ''}`),

    // 11. Insurance Policies & Renewal
    getInsurancePolicies: () => api.get('/insurance/policies'),

    // 12. Dependents Management
    getDependents: (employeeCode) => api.get(`/insurance/dependents/${employeeCode}`),
    addDependent: (data) => api.post('/insurance/dependents', data),

    // 13. Benefits & Insurance MIS Reports
    getMISReports: () => api.get('/benefits/mis-reports'),
};

export default benefitService;

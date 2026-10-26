import api from './api';

const biometricService = {
    importBiometricLogs: (formData) => api.post('/biometric/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),

    getPendingLogs: () => api.get('/biometric/pending'),

    // Future: approve logs
};

export default biometricService;

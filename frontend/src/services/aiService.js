import api from './api';

const aiService = {
    chat: (message, context = {}) => api.post('/ai/chat', { message, context }),
    screenCandidate: (candidateId) => api.post(`/ai/screen-candidate/${candidateId}`),
    getCompliancePrediction: () => api.get('/ai/compliance-prediction')
};

export default aiService;


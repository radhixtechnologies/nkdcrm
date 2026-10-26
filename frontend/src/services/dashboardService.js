import api from './api';

const dashboardService = {
    getStats: () => api.get('/dashboard/stats'),
    getCharts: () => api.get('/dashboard/charts'),
};

export default dashboardService;


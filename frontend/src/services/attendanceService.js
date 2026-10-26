import api from './api';

const attendanceService = {
    importDailyAttendance: (formData) => api.post('/daily-attendance/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),

    // List Daily Logs
    getDailyLogs: (start, end) => api.get(`/daily-attendance/list?startDate=${start}&endDate=${end}`),
};

export default attendanceService;

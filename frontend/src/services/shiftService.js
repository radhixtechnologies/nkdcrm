import api from './api';

const shiftService = {
    getAllShifts: () => api.get('/shifts'),
    createShift: (data) => api.post('/shifts', data),
    updateShift: (id, data) => api.put(`/shifts/${id}`, data),
    deleteShift: (id) => api.delete(`/shifts/${id}`),
    assignShift: (empCode, shiftId) => api.put(`/shifts/${empCode}/assign`, { shift_id: shiftId })
};

export default shiftService;

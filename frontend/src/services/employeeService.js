import api from './api';

const employeeService = {
    getEmployees: (params) => api.get('/employees', { params }),
    createEmployee: (data) => api.post('/employees', data),
    updateEmployee: (id, data) => api.put(`/employees/${id}`, data),
    getEmployeeById: (id) => api.get(`/employees/${id}`),
    getMyProfile: () => api.get('/employees/profile/me'),
    updateMyProfile: (data) => api.put('/employees/profile/update', data),
    changePassword: (data) => api.post('/auth/change-password', data),
    deleteEmployee: (id) => api.delete(`/employees/${id}`),
};

export default employeeService;

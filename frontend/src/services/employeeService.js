import api from './api';

const employeeService = {
    // Get all employees
    getEmployees: () => api.get('/employees'),

    // Create new employee
    createEmployee: (data) => api.post('/employees', data),

    // Update employee
    updateEmployee: (id, data) => api.put(`/employees/${id}`, data),

    // Get employee by ID
    getEmployeeById: (id) => api.get(`/employees/${id}`),

    // Self-Service Profile Update
    updateMyProfile: (data) => api.put('/employees/profile/update', data),

    // Delete Employee
    deleteEmployee: (id) => api.delete(`/employees/${id}`),
};

export default employeeService;

import api from './api';

const perkService = {
    // 1. Create Perk Type (HR)
    createType: (data) => api.post('/perks/create', data),

    // 2. List Perk Types
    getTypes: () => api.get('/perks'),

    // 3. Assign Perk (HR)
    assignPerk: (data) => api.post('/perks/assign', data),

    // 4. Get My Perks (Employee)
    getMyPerks: (employeeCode) => api.get(`/perks/my/${employeeCode}`),
};

export default perkService;

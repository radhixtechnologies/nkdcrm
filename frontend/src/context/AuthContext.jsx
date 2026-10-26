import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);

    // Initialize auth state from localStorage
    useEffect(() => {
        try {
            const storedToken = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');
            const storedPermissions = localStorage.getItem('permissions');

            if (storedToken && storedUser && storedUser !== 'undefined' && storedUser !== 'null') {
                const parsedUser = JSON.parse(storedUser);
                const parsedPermissions = (storedPermissions && storedPermissions !== 'undefined' && storedPermissions !== 'null')
                    ? JSON.parse(storedPermissions)
                    : [];

                setToken(storedToken);
                setUser(parsedUser);
                setPermissions(parsedPermissions);

                // Set default axios header
                api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
            }
        } catch (err) {
            console.error('Error restoring session from localStorage:', err);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('permissions');
            setToken(null);
            setUser(null);
            setPermissions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', {
                email,
                password
            });

            if (response.data && response.data.success) {
                const { token, user, permissions } = response.data.data;

                // Store in state
                setToken(token);
                setUser(user);
                setPermissions(permissions || []);

                // Store in localStorage
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(user));
                localStorage.setItem('permissions', JSON.stringify(permissions || []));

                // Set default axios header
                api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

                return { success: true };
            }

            return {
                success: false,
                message: response.data?.message || 'Login failed. Invalid credentials.'
            };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: error.response?.data?.message || 'Login failed. Please try again.'
            };
        }
    };

    const logout = async () => {
        try {
            // Call logout endpoint (optional)
            await api.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear state
            setToken(null);
            setUser(null);
            setPermissions([]);

            // Clear localStorage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('permissions');

            // Clear axios header
            delete api.defaults.headers.common['Authorization'];
        }
    };

    const hasPermission = (moduleCode, action = 'can_view') => {
        if (!user) return false;

        // Super Admin has all permissions
        if (user.role?.roleCode === 'SUPER_ADMIN') return true;

        // Check specific permission
        const permission = permissions.find(p => p.module_code === moduleCode);
        return permission ? permission[action] : false;
    };

    const hasRole = (...roles) => {
        if (!user || !user.role) return false;
        return roles.includes(user.role.roleCode);
    };

    const isAuthenticated = () => {
        return !!token && !!user;
    };

    const value = {
        user,
        token,
        permissions,
        loading,
        login,
        logout,
        hasPermission,
        hasRole,
        isAuthenticated
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

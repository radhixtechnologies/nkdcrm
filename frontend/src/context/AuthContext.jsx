import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

const clearAuthStorage = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
    delete api.defaults.headers.common['Authorization'];
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);

    const resetSessionState = useCallback(() => {
        setToken(null);
        setUser(null);
        setPermissions([]);
        clearAuthStorage();
    }, []);

    const refreshSession = useCallback(async () => {
        try {
            const res = await api.get('/auth/me');
            if (res.data?.success && res.data?.data?.user) {
                const freshUser = res.data.data.user;
                const freshPerms = res.data.data.permissions || [];
                setUser(freshUser);
                setPermissions(freshPerms);
                localStorage.setItem('user', JSON.stringify(freshUser));
                localStorage.setItem('permissions', JSON.stringify(freshPerms));
            }
        } catch (err) {
            if (err?.response?.status === 401 || err?.response?.status === 403) {
                resetSessionState();
            }
        }
    }, [resetSessionState]);

    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            try {
                const storedToken = localStorage.getItem('token');
                const storedUser = localStorage.getItem('user');
                const storedPermissions = localStorage.getItem('permissions');

                if (storedToken && storedUser && storedUser !== 'undefined' && storedUser !== 'null') {
                    const parsedUser = JSON.parse(storedUser);
                    const parsedPermissions = (storedPermissions && storedPermissions !== 'undefined' && storedPermissions !== 'null')
                        ? JSON.parse(storedPermissions)
                        : [];

                    if (mounted) {
                        setToken(storedToken);
                        setUser(parsedUser);
                        setPermissions(parsedPermissions);
                        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
                    }

                    // Hydrate live role/permissions from DB on boot
                    await refreshSession();
                } else {
                    clearAuthStorage();
                }
            } catch (err) {
                console.error('Error restoring session from localStorage:', err);
                if (mounted) resetSessionState();
            } finally {
                if (mounted) setLoading(false);
            }
        };

        initAuth();

        const handleExpired = () => resetSessionState();
        window.addEventListener('nkd-auth-expired', handleExpired);
        return () => {
            mounted = false;
            window.removeEventListener('nkd-auth-expired', handleExpired);
        };
    }, [refreshSession, resetSessionState]);

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', {
                email,
                password
            });

            if (response.data && response.data.success) {
                const { token: newToken, user: newUser, permissions: newPermissions } = response.data.data;

                setToken(newToken);
                setUser(newUser);
                setPermissions(newPermissions || []);

                localStorage.setItem('token', newToken);
                localStorage.setItem('user', JSON.stringify(newUser));
                localStorage.setItem('permissions', JSON.stringify(newPermissions || []));

                api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

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
            await api.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            resetSessionState();
        }
    };

    const getRoleCode = useCallback(() => {
        if (!user) return '';
        const raw = user.roleCode || user.role?.roleCode || (typeof user.role === 'string' ? user.role : '');
        return String(raw || '').toUpperCase();
    }, [user]);

    const hasPermission = useCallback((moduleCode, action = 'can_view') => {
        if (!user) return false;
        if (getRoleCode() === 'SUPER_ADMIN') return true;
        const permission = permissions.find(p => p.module_code === moduleCode);
        return permission ? Boolean(permission[action]) : false;
    }, [user, permissions, getRoleCode]);

    const hasRole = useCallback((...roles) => {
        const currentRole = getRoleCode();
        if (!currentRole) return false;
        const flattened = roles.flat().map(r => String(r).toUpperCase());
        return flattened.includes(currentRole);
    }, [getRoleCode]);

    const isAuthenticated = useCallback(() => {
        return !!token && !!user;
    }, [token, user]);

    const value = {
        user,
        token,
        permissions,
        loading,
        login,
        logout,
        refreshSession,
        hasPermission,
        hasRole,
        getRoleCode,
        isAuthenticated
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

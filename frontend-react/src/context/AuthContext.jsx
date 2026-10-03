import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const API_BASE_URL = 'http://127.0.0.1:8000';
export const GOOGLE_CLIENT_ID = '396252275172-hq4eja7pbqgm87o02ob9b2bvsma5m9qu.apps.googleusercontent.com';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const email = localStorage.getItem('user_email');
        const token = localStorage.getItem('access_token');
        return token ? { email: email || 'User', token } : null;
    });

    const saveTokens = (access, refresh, email) => {
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        if (email) localStorage.setItem('user_email', email);
        setUser({ email: email || 'User', token: access });
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_email');
        setUser(null);
    };

    const apiFetch = async (endpoint, options = {}) => {
        const token = localStorage.getItem('access_token');
        const headers = {
            ...(options.headers || {}),
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        if (!(options.body instanceof FormData) && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (response.status === 401 && token) {
            logout();
        }

        return response;
    };

    const login = async (username, password) => {
        const response = await fetch(`${API_BASE_URL}/api/token/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            saveTokens(data.access, data.refresh, username);
            return { success: true };
        }
        return { success: false, error: data.detail || 'Login failed' };
    };

    const register = async (email, password) => {
        const response = await fetch(`${API_BASE_URL}/api/auth/register/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok) {
            saveTokens(data.access, data.refresh, data.email);
            return { success: true };
        }
        return { success: false, error: data.detail || JSON.stringify(data) };
    };

    const googleLogin = async (idToken) => {
        const response = await fetch(`${API_BASE_URL}/api/auth/google/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: idToken })
        });
        const data = await response.json();
        if (response.ok) {
            saveTokens(data.access, data.refresh, data.email);
            return { success: true };
        }
        return { success: false, error: data.detail || 'Google Login failed' };
    };

    return (
        <AuthContext.Provider value={{ user, login, register, googleLogin, logout, apiFetch }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

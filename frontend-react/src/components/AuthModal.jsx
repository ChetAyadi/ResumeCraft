import React, { useState, useEffect } from 'react';
import { useAuth, GOOGLE_CLIENT_ID } from '../context/AuthContext';

export const AuthModal = ({ isOpen, onClose }) => {
    const { login, register, googleLogin } = useAuth();
    const [isLoginTab, setIsLoginTab] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        // Initialize Google Sign-In button when modal opens
        const initializeGoogle = () => {
            if (window.google && GOOGLE_CLIENT_ID) {
                window.google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: handleGoogleResponse
                });
                const btnContainer = document.getElementById('googleBtnContainer');
                if (btnContainer) {
                    window.google.accounts.id.renderButton(btnContainer, {
                        theme: 'filled_blue',
                        size: 'large',
                        width: '100%',
                        shape: 'pill'
                    });
                }
            }
        };

        if (window.google) {
            initializeGoogle();
        } else {
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.onload = initializeGoogle;
            document.body.appendChild(script);
        }
    }, [isOpen]);

    const handleGoogleResponse = async (response) => {
        if (!response.credential) return;
        setLoading(true);
        setError('');
        const res = await googleLogin(response.credential);
        setLoading(false);
        if (res.success) {
            onClose();
        } else {
            setError(res.error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const res = isLoginTab ? await login(email, password) : await register(email, password);
        setLoading(false);
        if (res.success) {
            setEmail('');
            setPassword('');
            onClose();
        } else {
            setError(res.error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content card-premium text-white border-0 shadow-lg">
                    <div className="modal-header border-bottom border-secondary border-opacity-25 pb-3">
                        <h5 className="modal-title fw-bold">
                            <i className="bi bi-shield-lock-fill text-primary me-2"></i>
                            {isLoginTab ? 'Account Sign In' : 'Create New Account'}
                        </h5>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>

                    <div className="modal-body p-4">
                        <ul className="nav nav-pills nav-justified mb-4 bg-dark p-1 rounded">
                            <li className="nav-item">
                                <button
                                    className={`nav-link btn-sm ${isLoginTab ? 'active bg-primary text-white' : 'text-muted'}`}
                                    onClick={() => { setIsLoginTab(true); setError(''); }}
                                >
                                    Sign In
                                </button>
                            </li>
                            <li className="nav-item">
                                <button
                                    className={`nav-link btn-sm ${!isLoginTab ? 'active bg-primary text-white' : 'text-muted'}`}
                                    onClick={() => { setIsLoginTab(false); setError(''); }}
                                >
                                    Register
                                </button>
                            </li>
                        </ul>

                        {error && (
                            <div className="alert alert-danger py-2 text-xs d-flex align-items-center">
                                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="mb-3">
                                <label className="form-label text-xs text-muted">Email Address</label>
                                <input
                                    type="email"
                                    className="form-control bg-dark text-white border-secondary border-opacity-50"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="form-label text-xs text-muted">Password</label>
                                <input
                                    type="password"
                                    className="form-control bg-dark text-white border-secondary border-opacity-50"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            <button type="submit" className="btn btn-primary-custom w-100 py-2 mb-3" disabled={loading}>
                                {loading ? 'Processing...' : (isLoginTab ? 'Sign In to Account' : 'Register Account')}
                            </button>
                        </form>

                        <div className="position-relative my-4 text-center">
                            <hr className="border-secondary border-opacity-25" />
                            <span className="position-absolute top-50 start-50 translate-middle bg-dark px-2 text-xs text-muted">
                                OR CONTINUE WITH
                            </span>
                        </div>

                        <div id="googleBtnContainer" className="d-flex justify-content-center"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

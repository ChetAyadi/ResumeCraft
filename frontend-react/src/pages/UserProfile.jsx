import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const UserProfile = () => {
    const { user, apiFetch } = useAuth();
    const navigate = useNavigate();

    const [profile, setProfile] = useState({
        first_name: '',
        last_name: '',
        email: '',
        date_joined: '',
        stats: { total_resumes: 0, total_scans: 0, avg_score: 0 }
    });

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    useEffect(() => {
        if (user) {
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        try {
            const response = await apiFetch('/api/auth/profile/');
            if (response.ok) {
                const data = await response.json();
                setProfile(data);
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        }
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setMsg({ type: '', text: '' });

        if (newPassword && newPassword !== confirmPassword) {
            setMsg({ type: 'danger', text: 'New passwords do not match.' });
            return;
        }

        setLoading(true);
        try {
            const payload = {
                first_name: profile.first_name,
                last_name: profile.last_name,
                email: profile.email
            };

            if (newPassword) {
                payload.new_password = newPassword;
            }

            const response = await apiFetch('/api/auth/profile/', {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setMsg({ type: 'success', text: 'Profile details updated successfully!' });
                setNewPassword('');
                setConfirmPassword('');
                fetchProfile();
            } else {
                setMsg({ type: 'danger', text: 'Failed to update profile.' });
            }
        } catch (err) {
            console.error('Error updating profile:', err);
            setMsg({ type: 'danger', text: 'Server error during profile update.' });
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="container py-5 text-center">
                <div className="card-premium p-5 col-lg-6 mx-auto">
                    <i className="bi bi-shield-lock fs-1 text-primary mb-3"></i>
                    <h4>Authentication Required</h4>
                    <p className="text-muted text-xs mb-4">Please sign in to view and manage your profile settings.</p>
                    <button className="btn btn-primary-custom" onClick={() => navigate('/')}>
                        Go to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-5">
            <h2 className="fw-bold mb-4">
                <i className="bi bi-person-bounding-box me-2 text-primary"></i> Account Profile & Settings
            </h2>

            {/* Profile Overview Banner */}
            <div className="card-premium p-4 mb-4">
                <div className="d-flex flex-wrap align-items-center gap-4">
                    <div
                        className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold display-6"
                        style={{ width: '80px', height: '80px' }}
                    >
                        {(profile.first_name?.[0] || profile.email?.[0] || 'U').toUpperCase()}
                    </div>
                    <div>
                        <h4 className="fw-bold mb-1">
                            {profile.first_name ? `${profile.first_name} ${profile.last_name}` : profile.email}
                        </h4>
                        <p className="text-muted text-xs mb-2">
                            <i className="bi bi-envelope me-1"></i> {profile.email}
                        </p>
                        <span className="badge bg-dark border border-secondary border-opacity-50 text-xs">
                            Member since {profile.date_joined ? new Date(profile.date_joined).toLocaleDateString() : '2026'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Account Activity Statistics */}
            <div className="row g-4 mb-4">
                <div className="col-md-4">
                    <div className="card-premium p-4 text-center">
                        <i className="bi bi-file-earmark-text text-primary fs-2 mb-2"></i>
                        <h3 className="fw-bold mb-0">{profile.stats.total_resumes}</h3>
                        <small className="text-xs text-muted">Saved Resumes</small>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card-premium p-4 text-center">
                        <i className="bi bi-speedometer2 text-success fs-2 mb-2"></i>
                        <h3 className="fw-bold mb-0">{profile.stats.total_scans}</h3>
                        <small className="text-xs text-muted">ATS Scans Performed</small>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card-premium p-4 text-center">
                        <i className="bi bi-graph-up-arrow text-warning fs-2 mb-2"></i>
                        <h3 className="fw-bold mb-0">{profile.stats.avg_score}%</h3>
                        <small className="text-xs text-muted">Avg Compatibility Score</small>
                    </div>
                </div>
            </div>

            {/* Update Profile Details Form */}
            <div className="card-premium p-4 mb-4">
                <h5 className="fw-bold mb-3 border-bottom pb-2">
                    <i className="bi bi-pencil-square me-2 text-primary"></i> Edit Profile Information
                </h5>

                {msg.text && (
                    <div className={`alert alert-${msg.type} py-2 text-xs mb-4`}>
                        {msg.text}
                    </div>
                )}

                <form onSubmit={handleUpdateProfile}>
                    <div className="row g-3">
                        <div className="col-md-6">
                            <label className="form-label text-xs text-muted">First Name</label>
                            <input
                                type="text"
                                className="form-control bg-dark text-white border-secondary border-opacity-50 text-xs"
                                value={profile.first_name}
                                onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                            />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label text-xs text-muted">Last Name</label>
                            <input
                                type="text"
                                className="form-control bg-dark text-white border-secondary border-opacity-50 text-xs"
                                value={profile.last_name}
                                onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                            />
                        </div>
                        <div className="col-12">
                            <label className="form-label text-xs text-muted">Email Address</label>
                            <input
                                type="email"
                                className="form-control bg-dark text-white border-secondary border-opacity-50 text-xs"
                                value={profile.email}
                                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                required
                            />
                        </div>

                        <div className="col-12 mt-4 pt-3 border-top border-secondary border-opacity-25">
                            <h6 className="fw-bold text-xs text-muted text-uppercase mb-3">Change Security Password (Optional)</h6>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label text-xs text-muted">New Password</label>
                                    <input
                                        type="password"
                                        className="form-control bg-dark text-white border-secondary border-opacity-50 text-xs"
                                        placeholder="Leave blank to keep current"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label text-xs text-muted">Confirm New Password</label>
                                    <input
                                        type="password"
                                        className="form-control bg-dark text-white border-secondary border-opacity-50 text-xs"
                                        placeholder="Confirm new password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="col-12 mt-4">
                            <button type="submit" className="btn btn-primary-custom px-4 py-2" disabled={loading}>
                                <i className="bi bi-check-circle me-1"></i> {loading ? 'Updating Profile...' : 'Save Profile Changes'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

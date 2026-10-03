import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export const Dashboard = ({ onOpenAuthModal }) => {
    const { user, apiFetch } = useAuth();
    const navigate = useNavigate();
    const [resumes, setResumes] = useState([]);
    const [scans, setScans] = useState([]);
    const [loadingResumes, setLoadingResumes] = useState(false);
    const [loadingScans, setLoadingScans] = useState(false);

    useEffect(() => {
        if (user) {
            fetchSavedResumes();
            fetchAtsScans();
        }
    }, [user]);

    const fetchSavedResumes = async () => {
        setLoadingResumes(true);
        try {
            const response = await apiFetch('/api/resumes/');
            if (response.ok) {
                const data = await response.json();
                setResumes(data);
            }
        } catch (err) {
            console.error('Error fetching resumes:', err);
        } finally {
            setLoadingResumes(false);
        }
    };

    const fetchAtsScans = async () => {
        setLoadingScans(true);
        try {
            const response = await apiFetch('/api/scans/');
            if (response.ok) {
                const data = await response.json();
                setScans(data);
            }
        } catch (err) {
            console.error('Error fetching scans:', err);
        } finally {
            setLoadingScans(false);
        }
    };

    const handleDeleteResume = async (id) => {
        if (!window.confirm('Are you sure you want to delete this resume?')) return;
        try {
            const response = await apiFetch(`/api/resumes/${id}/`, { method: 'DELETE' });
            if (response.ok) {
                setResumes((prev) => prev.filter((r) => r.id !== id));
            }
        } catch (err) {
            console.error('Error deleting resume:', err);
        }
    };

    // Chart.js data configuration for ATS scores over time
    const sortedScans = [...scans].reverse();
    const chartData = {
        labels: sortedScans.map((s) => new Date(s.created_at).toLocaleDateString()),
        datasets: [
            {
                label: 'ATS Match Score (%)',
                data: sortedScans.map((s) => s.score),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#2563eb',
                pointRadius: 4
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { mode: 'index', intersect: false }
        },
        scales: {
            y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
        }
    };

    return (
        <div className="container py-5">
            {/* Hero Banner */}
            <div className="card-premium p-5 mb-5 text-center position-relative overflow-hidden">
                <h1 className="fw-bold mb-3 display-5">
                    Build ATS-Optimized Resumes with <span className="text-primary">AI Power</span>
                </h1>
                <p className="text-muted col-lg-8 mx-auto lead mb-4">
                    Create tailored, professional resumes, score compatibility against job descriptions, and unlock AI cover letters and interview prep tools.
                </p>
                <div className="d-flex justify-content-center gap-3">
                    <Link to="/builder" className="btn btn-primary-custom px-4 py-2">
                        <i className="bi bi-magic me-2"></i> Create Resume
                    </Link>
                    <Link to="/ats" className="btn btn-outline-custom px-4 py-2">
                        <i className="bi bi-speedometer2 me-2"></i> Evaluate ATS Score
                    </Link>
                </div>
            </div>

            {/* User Dashboard */}
            {user ? (
                <div>
                    <h2 className="fw-bold mb-4 d-flex align-items-center">
                        <i className="bi bi-columns-gap me-2 text-primary"></i> Your Dashboard
                    </h2>
                    <div className="row g-4">
                        {/* Saved Resumes Column */}
                        <div className="col-md-6">
                            <div className="card-premium h-100 p-4">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h5 className="fw-bold mb-0">Saved Resumes</h5>
                                    <Link to="/builder" className="btn btn-xs btn-primary-custom">
                                        <i className="bi bi-plus-lg me-1"></i> New
                                    </Link>
                                </div>
                                <div className="list-group list-group-flush" id="resumesList">
                                    {loadingResumes ? (
                                        <p className="text-muted text-xs p-3">Loading saved resumes...</p>
                                    ) : resumes.length === 0 ? (
                                        <p className="text-muted text-xs p-3">No saved resumes found. Click "New" to start building.</p>
                                    ) : (
                                        resumes.map((res) => (
                                            <div key={res.id} className="list-group-item bg-transparent text-white border-secondary border-opacity-25 d-flex justify-content-between align-items-center py-3">
                                                <div>
                                                    <h6 className="mb-0 fw-semibold">{res.title || 'Untitled Resume'}</h6>
                                                    <small className="text-xs text-muted">Edited {new Date(res.updated_at).toLocaleDateString()}</small>
                                                </div>
                                                <div className="d-flex gap-2">
                                                    <button onClick={() => navigate(`/builder?id=${res.id}`)} className="btn btn-xs btn-outline-custom">
                                                        <i className="bi bi-pencil-square me-1"></i> Edit
                                                    </button>
                                                    <button onClick={() => handleDeleteResume(res.id)} className="btn btn-xs btn-outline-danger">
                                                        <i className="bi bi-trash me-1"></i> Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Recent ATS Scans Column */}
                        <div className="col-md-6">
                            <div className="card-premium h-100 p-4">
                                <h5 className="fw-bold mb-3">Recent ATS Scans</h5>

                                {/* Chart.js Line Visualization */}
                                {scans.length > 0 && (
                                    <div className="mb-4 p-3 rounded bg-dark border border-secondary border-opacity-25" style={{ height: '180px' }}>
                                        <Line data={chartData} options={chartOptions} />
                                    </div>
                                )}

                                <div className="list-group list-group-flush" id="scansList">
                                    {loadingScans ? (
                                        <p className="text-muted text-xs p-3">Loading ATS score logs...</p>
                                    ) : scans.length === 0 ? (
                                        <p className="text-muted text-xs p-3">No previous scans found. Try evaluating your resume in ATS Scorer.</p>
                                    ) : (
                                        scans.map((scan) => (
                                            <div key={scan.id} className="list-group-item bg-transparent text-white border-secondary border-opacity-25 d-flex justify-content-between align-items-center py-3">
                                                <div>
                                                    <h6 className="mb-0 fw-semibold">
                                                        Score: <span className={`badge ${scan.score >= 80 ? 'bg-success' : scan.score >= 50 ? 'bg-warning' : 'bg-danger'}`}>{scan.score}%</span>
                                                    </h6>
                                                    <small className="text-xs text-muted">Scanned {new Date(scan.created_at).toLocaleDateString()}</small>
                                                </div>
                                                <Link to="/ats" className="btn btn-xs btn-outline-custom">
                                                    View Details
                                                </Link>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card-premium p-4 text-center">
                    <p className="text-muted mb-3">Sign in to save your progress, track ATS scan histories, and access saved resumes.</p>
                    <button className="btn btn-primary-custom px-4 py-2" onClick={onOpenAuthModal}>
                        <i className="bi bi-box-arrow-in-right me-2"></i> Sign In or Register
                    </button>
                </div>
            )}
        </div>
    );
};

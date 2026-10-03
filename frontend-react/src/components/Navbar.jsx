import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Navbar = ({ onOpenAuthModal }) => {
    const { user, logout } = useAuth();

    return (
        <nav className="navbar navbar-expand-lg navbar-dark navbar-custom py-3 sticky-top">
            <div className="container">
                <Link className="navbar-brand navbar-brand-custom" to="/">
                    <i className="bi bi-file-earmark-text-fill text-primary fs-4"></i>
                    <span>ResumeCraft <span className="badge bg-teal text-xs ms-1">AI</span></span>
                </Link>
                <button
                    className="navbar-toggler border-0"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#navbarNav"
                    aria-controls="navbarNav"
                    aria-expanded="false"
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse" id="navbarNav">
                    <ul className="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-4">
                        <li className="nav-item">
                            <NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to="/">
                                Dashboard
                            </NavLink>
                        </li>
                        <li className="nav-item">
                            <NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to="/builder">
                                Resume Builder
                            </NavLink>
                        </li>
                        <li className="nav-item">
                            <NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to="/ats">
                                ATS Scorer
                            </NavLink>
                        </li>
                    </ul>

                    <div className="d-flex align-items-center gap-3">
                        {user ? (
                            <div className="dropdown">
                                <button
                                    className="btn btn-outline-custom dropdown-toggle btn-sm d-flex align-items-center gap-2"
                                    type="button"
                                    data-bs-toggle="dropdown"
                                    aria-expanded="false"
                                >
                                    <i className="bi bi-person-circle text-primary"></i>
                                    <span>{user.email}</span>
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end shadow">
                                    <li>
                                        <Link className="dropdown-item d-flex align-items-center gap-2" to="/profile">
                                            <i className="bi bi-person-gear text-primary"></i> My Profile & Settings
                                        </Link>
                                    </li>
                                    <li><hr className="dropdown-divider border-secondary border-opacity-25" /></li>
                                    <li>
                                        <button className="dropdown-item text-danger d-flex align-items-center gap-2" onClick={logout}>
                                            <i className="bi bi-box-arrow-right"></i> Logout
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        ) : (
                            <button className="btn btn-primary-custom btn-sm" onClick={onOpenAuthModal}>
                                <i className="bi bi-box-arrow-in-right me-1"></i> Sign In
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

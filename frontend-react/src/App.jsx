import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { ChatbotWidget } from './components/ChatbotWidget';
import { Dashboard } from './pages/Dashboard';
import { ResumeBuilder } from './pages/ResumeBuilder';
import { AtsScorer } from './pages/AtsScorer';
import { UserProfile } from './pages/UserProfile';
import './styles.css';

export function App() {
    const [authModalOpen, setAuthModalOpen] = useState(false);

    return (
        <AuthProvider>
            <BrowserRouter>
                <div className="d-flex flex-column min-vh-100 bg-dark text-white">
                    <Navbar onOpenAuthModal={() => setAuthModalOpen(true)} />

                    <main className="flex-grow-1">
                        <Routes>
                            <Route path="/" element={<Dashboard onOpenAuthModal={() => setAuthModalOpen(true)} />} />
                            <Route path="/builder" element={<ResumeBuilder />} />
                            <Route path="/ats" element={<AtsScorer />} />
                            <Route path="/profile" element={<UserProfile />} />
                        </Routes>
                    </main>

                    <footer className="bg-dark border-top border-secondary border-opacity-25 py-4 text-center mt-auto">
                        <div className="container">
                            <p className="text-muted text-xs mb-0">&copy; 2026 ResumeCraft AI All Rights Reserved</p>
                        </div>
                    </footer>

                    <ChatbotWidget />
                    <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
                </div>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const AtsScorer = () => {
    const { user, apiFetch } = useAuth();
    const [jobDescription, setJobDescription] = useState('');
    const [resumeText, setResumeText] = useState('');
    const [resumeFile, setResumeFile] = useState(null);
    const [savedResumeId, setSavedResumeId] = useState('');
    const [sourceType, setSourceType] = useState('text');
    const [savedResumes, setSavedResumes] = useState([]);

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [scannedText, setScannedText] = useState('');

    // Toolkit Modal States
    const [coverLetterModal, setCoverLetterModal] = useState(false);
    const [coverLetterText, setCoverLetterText] = useState('');
    const [loadingCoverLetter, setLoadingCoverLetter] = useState(false);

    const [interviewModal, setInterviewModal] = useState(false);
    const [interviewQa, setInterviewQa] = useState([]);
    const [loadingQa, setLoadingQa] = useState(false);

    useEffect(() => {
        if (user) {
            fetchSavedResumes();
        }
    }, [user]);

    const fetchSavedResumes = async () => {
        try {
            const response = await apiFetch('/api/resumes/');
            if (response.ok) {
                const data = await response.json();
                setSavedResumes(data);
            }
        } catch (err) {
            console.error('Error loading saved resumes:', err);
        }
    };

    const handleEvaluate = async (e) => {
        e.preventDefault();
        if (!jobDescription.trim()) {
            alert('Please paste the target job description.');
            return;
        }

        setLoading(true);
        setResult(null);

        const formData = new FormData();
        formData.append('job_description', jobDescription);

        if (sourceType === 'file' && resumeFile) {
            formData.append('resume_file', resumeFile);
        } else if (sourceType === 'saved' && savedResumeId) {
            formData.append('resume_id', savedResumeId);
        } else {
            formData.append('resume_text', resumeText);
        }

        try {
            const response = await apiFetch('/api/ats/evaluate/', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                setResult(data.result);
                setScannedText(data.resume_text || resumeText);
            } else {
                alert('Evaluation failed. Check input details.');
            }
        } catch (err) {
            console.error('ATS evaluation error:', err);
            alert('Server connection error during evaluation.');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateCoverLetter = async () => {
        setCoverLetterModal(true);
        setLoadingCoverLetter(true);
        try {
            const response = await apiFetch('/api/ats/generate-cover-letter/', {
                method: 'POST',
                body: JSON.stringify({
                    resume_text: scannedText || resumeText,
                    job_description: jobDescription
                })
            });
            if (response.ok) {
                const data = await response.json();
                setCoverLetterText(data.cover_letter);
            }
        } catch (err) {
            console.error('Error generating cover letter:', err);
        } finally {
            setLoadingCoverLetter(false);
        }
    };

    const handleGenerateInterviewQa = async () => {
        setInterviewModal(true);
        setLoadingQa(true);
        try {
            const response = await apiFetch('/api/ats/generate-interview-qa/', {
                method: 'POST',
                body: JSON.stringify({
                    resume_text: scannedText || resumeText,
                    job_description: jobDescription
                })
            });
            if (response.ok) {
                const data = await response.json();
                setInterviewQa(data.qa || []);
            }
        } catch (err) {
            console.error('Error generating interview QA:', err);
        } finally {
            setLoadingQa(false);
        }
    };


    return (
        <div className="container py-5">
            <h2 className="fw-bold mb-4">
                <i className="bi bi-speedometer2 me-2 text-primary"></i> ATS Resume Match & Keyword Scorer
            </h2>

            <div className="row g-4">
                {/* Inputs Column Left */}
                <div className="col-lg-5">
                    <div className="card-premium p-4">
                        <form onSubmit={handleEvaluate}>
                            <div className="mb-4">
                                <label className="form-label text-xs text-muted">Target Job Description</label>
                                <textarea
                                    id="jobDescription"
                                    className="form-control bg-dark text-white border-secondary border-opacity-50 text-xs"
                                    rows="5"
                                    placeholder="Paste job description requirements here..."
                                    value={jobDescription}
                                    onChange={(e) => setJobDescription(e.target.value)}
                                    required
                                ></textarea>
                            </div>
                            
                            <div className="mb-3">
                                <label className="form-label text-xs text-muted">Resume Input Source</label>
                                <select
                                    className="form-select bg-dark text-white border-secondary border-opacity-50 text-xs"
                                    value={sourceType}
                                    onChange={(e) => setSourceType(e.target.value)}
                                >
                                    <option value="text">Paste Plain Text</option>
                                    <option value="file">Upload Resume File (PDF/Docx)</option>
                                    {user && <option value="saved">Select Saved Resume</option>}
                                </select>
                            </div>

                            {sourceType === 'text' && (
                                <div className="mb-4">
                                    <textarea
                                        className="form-control bg-dark text-white border-secondary border-opacity-50 text-xs"
                                        rows="6"
                                        placeholder="Paste candidate resume text..."
                                        value={resumeText}
                                        onChange={(e) => setResumeText(e.target.value)}
                                    ></textarea>
                                </div>
                            )}

                            {sourceType === 'file' && (
                                <div className="mb-4">
                                    <input
                                        type="file"
                                        className="form-control bg-dark text-white border-secondary border-opacity-50 text-xs"
                                        accept=".pdf,.docx,.txt"
                                        onChange={(e) => setResumeFile(e.target.files[0])}
                                    />
                                </div>
                            )}

                            {sourceType === 'saved' && (
                                <div className="mb-4">
                                    <select
                                        className="form-select bg-dark text-white border-secondary border-opacity-50 text-xs"
                                        value={savedResumeId}
                                        onChange={(e) => setSavedResumeId(e.target.value)}
                                    >
                                        <option value="">-- Choose Saved Resume --</option>
                                        {savedResumes.map((r) => (
                                            <option key={r.id} value={r.id}>{r.title}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <button type="submit" className="btn btn-primary-custom w-100 py-2" disabled={loading}>
                                {loading ? 'Analyzing with AI...' : 'Scan & Evaluate Score'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Score Output Column Right */}
                <div className="col-lg-7">
                    {!result && !loading && (
                        <div className="card-premium p-5 text-center text-muted">
                            <i className="bi bi-cpu fs-1 text-primary mb-3"></i>
                            <h5>No Evaluation Performed</h5>
                            <p className="text-xs">Paste your job description and resume to receive detailed ATS compatibility scores.</p>
                        </div>
                    )}

                    {loading && (
                        <div className="card-premium p-5 text-center">
                            <div className="spinner-border text-primary mb-3" role="status"></div>
                            <h5>AI Engine Analyzing Resume Compatibility...</h5>
                            <p className="text-xs text-muted">Matching keywords, parsing experience level, and formatting structure.</p>
                        </div>
                    )}

                    {result && (
                        <div className="d-flex flex-column gap-4">
                            {/* Score Card */}
                            <div className="card-premium p-4">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <div>
                                        <h4 className="fw-bold mb-0">ATS Compatibility Score</h4>
                                        <small className="text-xs text-muted">{result.summary}</small>
                                    </div>
                                    <div className={`display-5 fw-bold ${result.score >= 80 ? 'text-success' : result.score >= 50 ? 'text-warning' : 'text-danger'}`}>
                                        {result.score}%
                                    </div>
                                </div>

                                {/* Toolkit Buttons */}
                                <div className="d-flex gap-2 mt-3 pt-3 border-top border-secondary border-opacity-25">
                                    <button className="btn btn-sm btn-primary-custom" onClick={handleGenerateCoverLetter}>
                                        <i className="bi bi-file-earmark-text me-1"></i> Tailor Cover Letter
                                    </button>
                                    <button className="btn btn-sm btn-outline-custom" onClick={handleGenerateInterviewQa}>
                                        <i className="bi bi-question-circle me-1"></i> Interview Q&A Prep
                                    </button>
                                </div>
                            </div>

                            {/* Keywords Analysis */}
                            <div className="card-premium p-4">
                                <h6 className="fw-bold text-success mb-2">Matching Keywords</h6>
                                <div className="d-flex flex-wrap gap-2 mb-4">
                                    {result.matching_keywords?.map((kw, idx) => (
                                        <span key={idx} className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50">
                                            ✓ {kw}
                                        </span>
                                    ))}
                                </div>

                                <h6 className="fw-bold text-danger mb-2">Missing Critical Keywords</h6>
                                <div className="d-flex flex-wrap gap-2">
                                    {result.missing_keywords?.map((kw, idx) => (
                                        <span key={idx} className="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-50">
                                            ✗ {kw}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Cover Letter Modal */}
            {coverLetterModal && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content card-premium text-white border-0 shadow-lg">
                            <div className="modal-header border-bottom border-secondary border-opacity-25">
                                <h5 className="modal-title fw-bold"><i className="bi bi-file-earmark-text text-primary me-2"></i>Tailored Cover Letter</h5>
                                <button className="btn-close btn-close-white" onClick={() => setCoverLetterModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                {loadingCoverLetter ? (
                                    <p className="text-muted text-xs">Writing cover letter using Groq Llama-3 AI...</p>
                                ) : (
                                    <textarea className="form-control bg-dark text-white border-secondary text-xs" rows="12" value={coverLetterText} onChange={(e) => setCoverLetterText(e.target.value)}></textarea>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Interview Q&A Modal */}
            {interviewModal && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content card-premium text-white border-0 shadow-lg">
                            <div className="modal-header border-bottom border-secondary border-opacity-25">
                                <h5 className="modal-title fw-bold"><i className="bi bi-question-circle text-primary me-2"></i>Curated Interview Q&A Prep</h5>
                                <button className="btn-close btn-close-white" onClick={() => setInterviewModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                {loadingQa ? (
                                    <p className="text-muted text-xs">Generating 5 tailored interview questions...</p>
                                ) : (
                                    interviewQa.map((qa, idx) => (
                                        <div key={idx} className="mb-3 p-3 border border-secondary border-opacity-25 rounded bg-dark">
                                            <h6 className="fw-bold text-primary mb-1">Q{idx + 1}: {qa.question}</h6>
                                            <p className="text-xs text-muted mb-0"><strong>Suggested Strategy:</strong> {qa.answer}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

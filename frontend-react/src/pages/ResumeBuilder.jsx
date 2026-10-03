import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const INITIAL_RESUME = {
    id: null,
    title: 'My Resume',
    template_style: 'modern',
    accent_color: '#3b82f6',
    font_family: 'Inter',
    custom_sections: { certs: [], langs: [], awards: [], pubs: [] },
    enabled_sections: { certs: false, langs: false, awards: false, pubs: false },
    personal: {
        first_name: 'Alex',
        last_name: 'Morgan',
        email: 'alex.morgan@example.com',
        phone: '+1 (555) 019-2834',
        location: 'San Francisco, CA',
        website: 'alexmorgan.dev',
        linkedin: 'linkedin.com/in/alexmorgan',
        github: 'github.com/alexmorgan',
        summary: 'Driven Software Engineer with 4+ years of experience specializing in backend architecture, API optimization, and cloud services.'
    },
    experience: [
        {
            title: 'Senior Backend Engineer',
            company: 'TechCorp Solutions',
            location: 'San Francisco, CA',
            start_date: '2023-01',
            end_date: '',
            current: true,
            bullets: 'Architected high-throughput Django REST APIs serving 10M+ daily requests.\nOptimized PostgreSQL index paths, reducing query load by 25%.'
        }
    ],
    education: [
        {
            degree: 'B.S. Computer Science',
            school: 'University of Texas',
            location: 'Austin, TX',
            start_date: '2017-09',
            end_date: '2021-05',
            gpa: '3.8'
        }
    ],
    projects: [
        {
            name: 'ATS Scorer Engine',
            link: 'github.com/alexmorgan/ats-engine',
            description: 'Built automated keyword scoring pipeline using Llama-3 AI models.'
        }
    ],
    skills: [
        { name: 'Python', level: 'Expert' },
        { name: 'Django REST Framework', level: 'Advanced' },
        { name: 'React.js', level: 'Intermediate' }
    ]
};

export const ResumeBuilder = () => {
    const { user, apiFetch } = useAuth();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [resumeData, setResumeData] = useState(INITIAL_RESUME);
    const [draftBanner, setDraftBanner] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });

    const [aiSummaryModal, setAiSummaryModal] = useState(false);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [summaryOptions, setSummaryOptions] = useState(null);

    const resumeId = searchParams.get('id');

    useEffect(() => {
        if (resumeId && user) {
            fetchResume(resumeId);
        } else {
            const savedDraft = localStorage.getItem('resume_builder_autosave_draft');
            if (savedDraft) {
                setDraftBanner(true);
            }
        }
    }, [resumeId, user]);

    useEffect(() => {
        localStorage.setItem('resume_builder_autosave_draft', JSON.stringify(resumeData));
    }, [resumeData]);

    const fetchResume = async (id) => {
        try {
            const response = await apiFetch(`/api/resumes/${id}/`);
            if (response.ok) {
                const data = await response.json();
                setResumeData({
                    ...INITIAL_RESUME,
                    ...data,
                    custom_sections: data.custom_sections || { certs: [], langs: [], awards: [], pubs: [] },
                    enabled_sections: {
                        certs: (data.custom_sections?.certs?.length > 0),
                        langs: (data.custom_sections?.langs?.length > 0),
                        awards: (data.custom_sections?.awards?.length > 0),
                        pubs: (data.custom_sections?.pubs?.length > 0)
                    }
                });
            }
        } catch (err) {
            console.error('Error fetching resume:', err);
        }
    };

    const restoreDraft = () => {
        const savedDraft = localStorage.getItem('resume_builder_autosave_draft');
        if (savedDraft) {
            try {
                setResumeData(JSON.parse(savedDraft));
            } catch (e) { }
        }
        setDraftBanner(false);
    };

    const discardDraft = () => {
        localStorage.removeItem('resume_builder_autosave_draft');
        setDraftBanner(false);
    };

    const handleSaveCloud = async () => {
        if (!user) {
            setMsg({ type: 'warning', text: 'Please sign in to save your resume to cloud database.' });
            return;
        }

        setSaving(true);
        setMsg({ type: '', text: '' });

        try {
            const isUpdate = Boolean(resumeData.id);
            const endpoint = isUpdate ? `/api/resumes/${resumeData.id}/` : '/api/resumes/';
            const method = isUpdate ? 'PUT' : 'POST';

            const response = await apiFetch(endpoint, {
                method,
                body: JSON.stringify(resumeData)
            });

            if (response.ok) {
                const data = await response.json();
                setResumeData((prev) => ({ ...prev, id: data.id }));
                localStorage.removeItem('resume_builder_autosave_draft');
                setMsg({ type: 'success', text: 'Resume successfully saved to cloud!' });
                if (!isUpdate) navigate(`/builder?id=${data.id}`);
            } else {
                setMsg({ type: 'danger', text: 'Failed to save resume. Please check fields.' });
            }
        } catch (err) {
            console.error('Error saving resume:', err);
            setMsg({ type: 'danger', text: 'Server connection error during save.' });
        } finally {
            setSaving(false);
        }
    };

    const handlePrintPdf = () => {
        window.print();
    };

    const handleAiAutoWriteSummary = async () => {
        setAiSummaryModal(true);
        setLoadingSummary(true);
        setSummaryOptions(null);

        const skillsStr = resumeData.skills.map(s => s.name).join(', ');
        const expStr = resumeData.experience.map(e => `${e.title} at ${e.company}: ${e.bullets}`).join('; ');

        try {
            const response = await apiFetch('/api/ats/suggest-summary/', {
                method: 'POST',
                body: JSON.stringify({
                    skills: skillsStr || 'Software Development',
                    experience: expStr || 'Software engineer'
                })
            });
            if (response.ok) {
                const data = await response.json();
                setSummaryOptions(data.suggestions);
            }
        } catch (err) {
            console.error('Error generating AI summary:', err);
        } finally {
            setLoadingSummary(false);
        }
    };

    const addListItem = (key, newItem) => {
        setResumeData((prev) => ({
            ...prev,
            [key]: [...(prev[key] || []), newItem]
        }));
    };

    const updateListItem = (key, index, field, value) => {
        setResumeData((prev) => {
            const updated = [...(prev[key] || [])];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, [key]: updated };
        });
    };

    const removeListItem = (key, index) => {
        setResumeData((prev) => ({
            ...prev,
            [key]: (prev[key] || []).filter((_, i) => i !== index)
        }));
    };

    const addCustomItem = (sectionKey, newItem) => {
        setResumeData((prev) => ({
            ...prev,
            custom_sections: {
                ...prev.custom_sections,
                [sectionKey]: [...(prev.custom_sections[sectionKey] || []), newItem]
            }
        }));
    };

    const updateCustomItem = (sectionKey, index, field, value) => {
        setResumeData((prev) => {
            const updated = [...(prev.custom_sections[sectionKey] || [])];
            updated[index] = { ...updated[index], [field]: value };
            return {
                ...prev,
                custom_sections: {
                    ...prev.custom_sections,
                    [sectionKey]: updated
                }
            };
        });
    };

    const removeCustomItem = (sectionKey, index) => {
        setResumeData((prev) => ({
            ...prev,
            custom_sections: {
                ...prev.custom_sections,
                [sectionKey]: (prev.custom_sections[sectionKey] || []).filter((_, i) => i !== index)
            }
        }));
    };

    const toggleSection = (sec) => {
        setResumeData((prev) => ({
            ...prev,
            enabled_sections: {
                ...prev.enabled_sections,
                [sec]: !prev.enabled_sections[sec]
            }
        }));
    };

    // Render A4 Header depending on chosen 1 of 4 formats
    const renderResumeHeader = () => {
        const p = resumeData.personal;
        const style = resumeData.template_style;

        if (style === 'professional') {
            return (
                <div className="p-3 mb-4 rounded text-center text-white" style={{ backgroundColor: '#0f172a' }}>
                    <h1 className="fw-bold mb-1 text-white">{p.first_name} {p.last_name}</h1>
                    <p className="text-xs mb-0 text-slate-300 opacity-90">
                        {p.email} | {p.phone} | {p.location} {p.website && `| ${p.website}`}
                    </p>
                </div>
            );
        } else if (style === 'creative') {
            return (
                <div className="p-4 mb-4 rounded text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${resumeData.accent_color}, #0f172a)` }}>
                    <h1 className="fw-bold mb-1 text-white">{p.first_name} {p.last_name}</h1>
                    <div className="d-flex flex-wrap gap-2 text-xs text-white opacity-90">
                        <span><i className="bi bi-envelope me-1"></i>{p.email}</span>
                        <span><i className="bi bi-telephone me-1"></i>{p.phone}</span>
                        <span><i className="bi bi-geo-alt me-1"></i>{p.location}</span>
                    </div>
                </div>
            );
        } else if (style === 'minimal') {
            return (
                <div className="text-center pb-3 mb-3 border-bottom">
                    <h1 className="fw-bold mb-1 text-dark" style={{ letterSpacing: '1px' }}>{p.first_name} {p.last_name}</h1>
                    <p className="text-muted text-xs mb-0">
                        {p.email} • {p.phone} • {p.location} {p.website && `• ${p.website}`}
                    </p>
                </div>
            );
        } else {
            // Default Modern
            return (
                <div className="border-bottom pb-3 mb-3" style={{ borderColor: resumeData.accent_color }}>
                    <h1 className="fw-bold mb-1" style={{ color: resumeData.accent_color }}>
                        {p.first_name} {p.last_name}
                    </h1>
                    <p className="text-muted text-xs mb-0">
                        {p.email} | {p.phone} | {p.location} {p.website && `| ${p.website}`}
                    </p>
                </div>
            );
        }
    };

    return (
        <div className="container-fluid py-4 px-lg-5">
            {draftBanner && (
                <div className="alert alert-info d-flex justify-content-between align-items-center mb-4 card-premium text-white no-print">
                    <div className="d-flex align-items-center">
                        <i className="bi bi-clock-history text-info fs-4 me-3"></i>
                        <div>
                            <h6 className="mb-0 fw-bold">Unsaved Session Draft Found</h6>
                            <small className="text-xs text-muted">You have unsaved edits from your previous session.</small>
                        </div>
                    </div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-xs btn-primary-custom" onClick={restoreDraft}>
                            Restore
                        </button>
                        <button className="btn btn-xs btn-outline-custom" onClick={discardDraft}>
                            Discard
                        </button>
                    </div>
                </div>
            )}

            {/* Customizer Controls Bar */}
            <div className="card-premium p-3 mb-4 d-flex flex-wrap justify-content-between align-items-center gap-3 no-print">
                <div className="d-flex flex-wrap align-items-center gap-3">
                    <div className="d-flex align-items-center gap-2">
                        <label className="text-xs text-muted fw-bold">SELECT FORMAT / THEME:</label>
                        <select
                            className="form-select bg-dark text-white border-secondary text-xs fw-semibold"
                            style={{ minWidth: '170px' }}
                            value={resumeData.template_style}
                            onChange={(e) => setResumeData({ ...resumeData, template_style: e.target.value })}
                        >
                            <option value="modern">1. Modern Theme (Accent Top-Bar)</option>
                            <option value="professional">2. Professional Theme (Corporate Dark Header)</option>
                            <option value="creative">3. Creative Executive (Gradient Banner)</option>
                            <option value="minimal">4. Minimalist Theme (Clean Elegant)</option>
                        </select>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <label className="text-xs text-muted fw-bold">FONT:</label>
                        <select
                            className="form-select bg-dark text-white border-secondary text-xs"
                            value={resumeData.font_family}
                            onChange={(e) => setResumeData({ ...resumeData, font_family: e.target.value })}
                        >
                            <option value="Inter">Inter (Sans-Serif)</option>
                            <option value="Outfit">Outfit (Modern Sans)</option>
                            <option value="Roboto">Roboto (Clean Sans)</option>
                            <option value="Merriweather">Merriweather (Serif)</option>
                            <option value="Georgia">Georgia (Classic Serif)</option>
                            <option value="Courier Prime">Courier Prime (Monospace)</option>
                        </select>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <label className="text-xs text-muted fw-bold">ACCENT:</label>
                        <input
                            type="color"
                            className="form-control form-control-color bg-transparent border-0"
                            style={{ height: '30px', cursor: 'pointer' }}
                            value={resumeData.accent_color}
                            onChange={(e) => setResumeData({ ...resumeData, accent_color: e.target.value })}
                        />
                    </div>
                </div>

                <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-primary-custom" onClick={handleSaveCloud} disabled={saving}>
                        <i className="bi bi-floppy me-1"></i> {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button className="btn btn-sm btn-outline-custom" onClick={handlePrintPdf}>
                        <i className="bi bi-printer me-1"></i> Export PDF
                    </button>
                </div>
            </div>

            {msg.text && (
                <div className={`alert alert-${msg.type} py-2 text-xs mb-4 no-print`}>
                    {msg.text}
                </div>
            )}

            <div className="row g-4">
                {/* Left Side: Accordion Input Forms */}
                <div className="col-lg-6 no-print">
                    <div className="card-premium p-4 mb-4">
                        <div className="mb-3 p-3 border rounded bg-light">
                            <label className="form-label text-xs fw-bold text-muted mb-1">RESUME NAME / TITLE</label>
                            <input
                                type="text"
                                className="form-control bg-dark text-white border-secondary text-xs fw-semibold mb-3"
                                value={resumeData.title}
                                onChange={(e) => setResumeData({ ...resumeData, title: e.target.value })}
                            />

                            <label className="form-label text-xs fw-bold text-muted mb-1">ADD EXTRA SECTIONS</label>
                            <div className="d-flex flex-wrap gap-3">
                                {['certs', 'langs', 'awards', 'pubs'].map((sec) => (
                                    <div key={sec} className="form-check">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id={`toggle_${sec}`}
                                            checked={Boolean(resumeData.enabled_sections[sec])}
                                            onChange={() => toggleSection(sec)}
                                        />
                                        <label className="form-check-label text-xs text-white text-capitalize" htmlFor={`toggle_${sec}`}>
                                            {sec === 'certs' ? 'Certifications' : sec === 'langs' ? 'Languages' : sec === 'awards' ? 'Awards' : 'Publications'}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Accordion Form Sections */}
                        <div className="accordion" id="builderAccordion">
                            {/* 1. Personal Details */}
                            <div className="accordion-item border-0 border-bottom mb-2">
                                <h2 className="accordion-header">
                                    <button className="accordion-button fw-semibold" type="button" data-bs-toggle="collapse" data-bs-target="#collapsePersonal">
                                        <i className="bi bi-person-fill me-2 text-primary"></i> Personal Information
                                    </button>
                                </h2>
                                <div id="collapsePersonal" className="accordion-collapse collapse show" data-bs-parent="#builderAccordion">
                                    <div className="accordion-body px-0 py-3">
                                        <div className="row g-3">
                                            <div className="col-md-6">
                                                <label className="text-xs text-muted">First Name</label>
                                                <input type="text" className="form-control bg-dark text-white border-secondary text-xs" value={resumeData.personal.first_name} onChange={(e) => setResumeData({ ...resumeData, personal: { ...resumeData.personal, first_name: e.target.value } })} />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="text-xs text-muted">Last Name</label>
                                                <input type="text" className="form-control bg-dark text-white border-secondary text-xs" value={resumeData.personal.last_name} onChange={(e) => setResumeData({ ...resumeData, personal: { ...resumeData.personal, last_name: e.target.value } })} />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="text-xs text-muted">Email</label>
                                                <input type="email" className="form-control bg-dark text-white border-secondary text-xs" value={resumeData.personal.email} onChange={(e) => setResumeData({ ...resumeData, personal: { ...resumeData.personal, email: e.target.value } })} />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="text-xs text-muted">Phone</label>
                                                <input type="text" className="form-control bg-dark text-white border-secondary text-xs" value={resumeData.personal.phone} onChange={(e) => setResumeData({ ...resumeData, personal: { ...resumeData.personal, phone: e.target.value } })} />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="text-xs text-muted">Location</label>
                                                <input type="text" className="form-control bg-dark text-white border-secondary text-xs" value={resumeData.personal.location} onChange={(e) => setResumeData({ ...resumeData, personal: { ...resumeData.personal, location: e.target.value } })} />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="text-xs text-muted">Website</label>
                                                <input type="text" className="form-control bg-dark text-white border-secondary text-xs" value={resumeData.personal.website} onChange={(e) => setResumeData({ ...resumeData, personal: { ...resumeData.personal, website: e.target.value } })} />
                                            </div>
                                            <div className="col-12">
                                                <div className="d-flex justify-content-between align-items-center mb-1">
                                                    <label className="text-xs text-muted">Professional Summary</label>
                                                    <button type="button" className="btn btn-xs btn-outline-custom text-primary" onClick={handleAiAutoWriteSummary}>
                                                        <i className="bi bi-magic me-1"></i> AI Auto-Write
                                                    </button>
                                                </div>
                                                <textarea className="form-control bg-dark text-white border-secondary text-xs" rows="3" value={resumeData.personal.summary} onChange={(e) => setResumeData({ ...resumeData, personal: { ...resumeData.personal, summary: e.target.value } })}></textarea>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Work Experience */}
                            <div className="accordion-item border-0 border-bottom mb-2">
                                <h2 className="accordion-header">
                                    <button className="accordion-button collapsed fw-semibold" type="button" data-bs-toggle="collapse" data-bs-target="#collapseExperience">
                                        <i className="bi bi-briefcase-fill me-2 text-primary"></i> Work Experience
                                    </button>
                                </h2>
                                <div id="collapseExperience" className="accordion-collapse collapse" data-bs-parent="#builderAccordion">
                                    <div className="accordion-body px-0 py-3">
                                        {resumeData.experience.map((exp, idx) => (
                                            <div key={idx} className="p-3 border border-secondary border-opacity-25 rounded mb-3 bg-dark position-relative">
                                                <button type="button" className="btn-close btn-close-white position-absolute top-0 end-0 m-2 text-xs" onClick={() => removeListItem('experience', idx)}></button>
                                                <div className="row g-2">
                                                    <div className="col-md-6">
                                                        <input type="text" className="form-control bg-dark text-white border-secondary text-xs" placeholder="Job Title" value={exp.title} onChange={(e) => updateListItem('experience', idx, 'title', e.target.value)} />
                                                    </div>
                                                    <div className="col-md-6">
                                                        <input type="text" className="form-control bg-dark text-white border-secondary text-xs" placeholder="Company" value={exp.company} onChange={(e) => updateListItem('experience', idx, 'company', e.target.value)} />
                                                    </div>
                                                    <div className="col-md-6">
                                                        <input type="text" className="form-control bg-dark text-white border-secondary text-xs" placeholder="Start Date" value={exp.start_date} onChange={(e) => updateListItem('experience', idx, 'start_date', e.target.value)} />
                                                    </div>
                                                    <div className="col-md-6">
                                                        <input type="text" className="form-control bg-dark text-white border-secondary text-xs" placeholder="End Date (or Present)" value={exp.end_date} onChange={(e) => updateListItem('experience', idx, 'end_date', e.target.value)} />
                                                    </div>
                                                    <div className="col-12">
                                                        <textarea className="form-control bg-dark text-white border-secondary text-xs" rows="3" placeholder="Bullet achievements..." value={exp.bullets} onChange={(e) => updateListItem('experience', idx, 'bullets', e.target.value)}></textarea>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <button type="button" className="btn btn-sm btn-outline-custom w-100" onClick={() => addListItem('experience', { title: '', company: '', start_date: '', end_date: '', bullets: '' })}>
                                            <i className="bi bi-plus-lg me-1"></i> Add Experience
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Education */}
                            <div className="accordion-item border-0 border-bottom mb-2">
                                <h2 className="accordion-header">
                                    <button className="accordion-button collapsed fw-semibold" type="button" data-bs-toggle="collapse" data-bs-target="#collapseEducation">
                                        <i className="bi bi-mortarboard-fill me-2 text-primary"></i> Education
                                    </button>
                                </h2>
                                <div id="collapseEducation" className="accordion-collapse collapse" data-bs-parent="#builderAccordion">
                                    <div className="accordion-body px-0 py-3">
                                        {resumeData.education.map((edu, idx) => (
                                            <div key={idx} className="p-3 border border-secondary border-opacity-25 rounded mb-3 bg-dark position-relative">
                                                <button type="button" className="btn-close btn-close-white position-absolute top-0 end-0 m-2 text-xs" onClick={() => removeListItem('education', idx)}></button>
                                                <div className="row g-2">
                                                    <div className="col-md-6">
                                                        <input type="text" className="form-control bg-dark text-white border-secondary text-xs" placeholder="Degree / Certificate" value={edu.degree} onChange={(e) => updateListItem('education', idx, 'degree', e.target.value)} />
                                                    </div>
                                                    <div className="col-md-6">
                                                        <input type="text" className="form-control bg-dark text-white border-secondary text-xs" placeholder="School / University" value={edu.school} onChange={(e) => updateListItem('education', idx, 'school', e.target.value)} />
                                                    </div>
                                                    <div className="col-md-6">
                                                        <input type="text" className="form-control bg-dark text-white border-secondary text-xs" placeholder="Start Date" value={edu.start_date} onChange={(e) => updateListItem('education', idx, 'start_date', e.target.value)} />
                                                    </div>
                                                    <div className="col-md-6">
                                                        <input type="text" className="form-control bg-dark text-white border-secondary text-xs" placeholder="End Date" value={edu.end_date} onChange={(e) => updateListItem('education', idx, 'end_date', e.target.value)} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <button type="button" className="btn btn-sm btn-outline-custom w-100" onClick={() => addListItem('education', { degree: '', school: '', start_date: '', end_date: '' })}>
                                            <i className="bi bi-plus-lg me-1"></i> Add Education
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Projects */}
                            <div className="accordion-item border-0 border-bottom mb-2">
                                <h2 className="accordion-header">
                                    <button className="accordion-button collapsed fw-semibold" type="button" data-bs-toggle="collapse" data-bs-target="#collapseProjects">
                                        <i className="bi bi-kanban-fill me-2 text-primary"></i> Projects
                                    </button>
                                </h2>
                                <div id="collapseProjects" className="accordion-collapse collapse" data-bs-parent="#builderAccordion">
                                    <div className="accordion-body px-0 py-3">
                                        {resumeData.projects.map((proj, idx) => (
                                            <div key={idx} className="p-3 border border-secondary border-opacity-25 rounded mb-3 bg-dark position-relative">
                                                <button type="button" className="btn-close btn-close-white position-absolute top-0 end-0 m-2 text-xs" onClick={() => removeListItem('projects', idx)}></button>
                                                <div className="row g-2">
                                                    <div className="col-md-6">
                                                        <input type="text" className="form-control bg-dark text-white border-secondary text-xs" placeholder="Project Name" value={proj.name} onChange={(e) => updateListItem('projects', idx, 'name', e.target.value)} />
                                                    </div>
                                                    <div className="col-md-6">
                                                        <input type="text" className="form-control bg-dark text-white border-secondary text-xs" placeholder="Project Link" value={proj.link} onChange={(e) => updateListItem('projects', idx, 'link', e.target.value)} />
                                                    </div>
                                                    <div className="col-12">
                                                        <input type="text" className="form-control bg-dark text-white border-secondary text-xs" placeholder="Description" value={proj.description} onChange={(e) => updateListItem('projects', idx, 'description', e.target.value)} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <button type="button" className="btn btn-sm btn-outline-custom w-100" onClick={() => addListItem('projects', { name: '', link: '', description: '' })}>
                                            <i className="bi bi-plus-lg me-1"></i> Add Project
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 5. Skills */}
                            <div className="accordion-item border-0 border-bottom mb-2">
                                <h2 className="accordion-header">
                                    <button className="accordion-button collapsed fw-semibold" type="button" data-bs-toggle="collapse" data-bs-target="#collapseSkills">
                                        <i className="bi bi-tools me-2 text-primary"></i> Skills
                                    </button>
                                </h2>
                                <div id="collapseSkills" className="accordion-collapse collapse" data-bs-parent="#builderAccordion">
                                    <div className="accordion-body px-0 py-3">
                                        {resumeData.skills.map((sk, idx) => (
                                            <div key={idx} className="d-flex gap-2 mb-2 align-items-center">
                                                <input type="text" className="form-control bg-dark text-white border-secondary text-xs" placeholder="Skill Name (e.g. Python)" value={sk.name} onChange={(e) => updateListItem('skills', idx, 'name', e.target.value)} />
                                                <button type="button" className="btn btn-xs btn-outline-danger" onClick={() => removeListItem('skills', idx)}>
                                                    <i className="bi bi-trash"></i>
                                                </button>
                                            </div>
                                        ))}
                                        <button type="button" className="btn btn-sm btn-outline-custom w-100 mt-2" onClick={() => addListItem('skills', { name: '', level: 'Intermediate' })}>
                                            <i className="bi bi-plus-lg me-1"></i> Add Skill
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 6. Certifications */}
                            {resumeData.enabled_sections.certs && (
                                <div className="accordion-item border-0 border-bottom mb-2">
                                    <h2 className="accordion-header">
                                        <button className="accordion-button collapsed fw-semibold" type="button" data-bs-toggle="collapse" data-bs-target="#collapseCerts">
                                            <i className="bi bi-award-fill me-2 text-primary"></i> Certifications
                                        </button>
                                    </h2>
                                    <div id="collapseCerts" className="accordion-collapse collapse" data-bs-parent="#builderAccordion">
                                        <div className="accordion-body px-0 py-3">
                                            {(resumeData.custom_sections.certs || []).map((item, idx) => (
                                                <div key={idx} className="p-3 border border-secondary border-opacity-25 rounded mb-3 bg-dark position-relative">
                                                    <button type="button" className="btn-close btn-close-white position-absolute top-0 end-0 m-2 text-xs" onClick={() => removeCustomItem('certs', idx)}></button>
                                                    <div className="row g-2">
                                                        <div className="col-md-6">
                                                            <input type="text" className="form-control bg-dark text-white border-secondary text-xs" placeholder="Certification Name" value={item.name || ''} onChange={(e) => updateCustomItem('certs', idx, 'name', e.target.value)} />
                                                        </div>
                                                        <div className="col-md-6">
                                                            <input type="text" className="form-control bg-dark text-white border-secondary text-xs" placeholder="Authority (e.g. AWS)" value={item.authority || ''} onChange={(e) => updateCustomItem('certs', idx, 'authority', e.target.value)} />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            <button type="button" className="btn btn-sm btn-outline-custom w-100" onClick={() => addCustomItem('certs', { name: '', authority: '', date: '' })}>
                                                <i className="bi bi-plus-lg me-1"></i> Add Certification
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 7. Languages */}
                            {resumeData.enabled_sections.langs && (
                                <div className="accordion-item border-0 border-bottom mb-2">
                                    <h2 className="accordion-header">
                                        <button className="accordion-button collapsed fw-semibold" type="button" data-bs-toggle="collapse" data-bs-target="#collapseLangs">
                                            <i className="bi bi-translate me-2 text-primary"></i> Languages
                                        </button>
                                    </h2>
                                    <div id="collapseLangs" className="accordion-collapse collapse" data-bs-parent="#builderAccordion">
                                        <div className="accordion-body px-0 py-3">
                                            {(resumeData.custom_sections.langs || []).map((item, idx) => (
                                                <div key={idx} className="d-flex gap-2 mb-2 align-items-center">
                                                    <input type="text" className="form-control bg-dark text-white border-secondary text-xs" placeholder="Language (e.g. English)" value={item.name || ''} onChange={(e) => updateCustomItem('langs', idx, 'name', e.target.value)} />
                                                    <button type="button" className="btn btn-xs btn-outline-danger" onClick={() => removeCustomItem('langs', idx)}>
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                </div>
                                            ))}
                                            <button type="button" className="btn btn-sm btn-outline-custom w-100 mt-2" onClick={() => addCustomItem('langs', { name: '', proficiency: 'Fluent' })}>
                                                <i className="bi bi-plus-lg me-1"></i> Add Language
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side: A4 Sheet Live Preview */}
                <div className="col-lg-6">
                    <div className="preview-container">
                        <div
                            className={`resume-sheet theme-${resumeData.template_style || 'modern'}`}
                            style={{
                                fontFamily: resumeData.font_family,
                                ['--accent-color']: resumeData.accent_color
                            }}
                        >
                            {/* Dynamic 4 Formats Header */}
                            {renderResumeHeader()}

                            {/* Summary */}
                            {resumeData.personal.summary && (
                                <div className="mb-3">
                                    <h6 className="fw-bold text-uppercase tracking-wider" style={{ color: resumeData.accent_color }}>Summary</h6>
                                    <p className="text-xs mb-0">{resumeData.personal.summary}</p>
                                </div>
                            )}

                            {/* Experience */}
                            {resumeData.experience.length > 0 && (
                                <div className="mb-3">
                                    <h6 className="fw-bold text-uppercase tracking-wider" style={{ color: resumeData.accent_color }}>Work Experience</h6>
                                    {resumeData.experience.map((exp, idx) => (
                                        <div key={idx} className="mb-2">
                                            <div className="d-flex justify-content-between">
                                                <strong className="text-xs">{exp.title} - {exp.company}</strong>
                                                <small className="text-xs text-muted">{exp.start_date} - {exp.end_date || 'Present'}</small>
                                            </div>
                                            <p className="text-xs text-muted mb-0" style={{ whiteSpace: 'pre-line' }}>{exp.bullets}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Education */}
                            {resumeData.education.length > 0 && (
                                <div className="mb-3">
                                    <h6 className="fw-bold text-uppercase tracking-wider" style={{ color: resumeData.accent_color }}>Education</h6>
                                    {resumeData.education.map((edu, idx) => (
                                        <div key={idx} className="d-flex justify-content-between mb-1">
                                            <span className="text-xs"><strong>{edu.degree}</strong>, {edu.school}</span>
                                            <small className="text-xs text-muted">{edu.start_date} - {edu.end_date}</small>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Projects */}
                            {resumeData.projects.length > 0 && (
                                <div className="mb-3">
                                    <h6 className="fw-bold text-uppercase tracking-wider" style={{ color: resumeData.accent_color }}>Projects</h6>
                                    {resumeData.projects.map((proj, idx) => (
                                        <div key={idx} className="mb-1">
                                            <strong className="text-xs">{proj.name}</strong> <small className="text-muted">({proj.link})</small>
                                            <p className="text-xs text-muted mb-0">{proj.description}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Skills */}
                            {resumeData.skills.length > 0 && (
                                <div className="mb-3">
                                    <h6 className="fw-bold text-uppercase tracking-wider" style={{ color: resumeData.accent_color }}>Skills</h6>
                                    <div className="d-flex flex-wrap gap-1">
                                        {resumeData.skills.map((s, idx) => (
                                            <span key={idx} className="badge bg-light text-dark border text-xs">
                                                {s.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Custom Sections: Certifications */}
                            {resumeData.enabled_sections.certs && resumeData.custom_sections.certs?.length > 0 && (
                                <div className="mb-3">
                                    <h6 className="fw-bold text-uppercase tracking-wider" style={{ color: resumeData.accent_color }}>Certifications</h6>
                                    {resumeData.custom_sections.certs.map((c, idx) => (
                                        <p key={idx} className="text-xs mb-0"><strong>{c.name}</strong> - {c.authority}</p>
                                    ))}
                                </div>
                            )}

                            {/* Custom Sections: Languages */}
                            {resumeData.enabled_sections.langs && resumeData.custom_sections.langs?.length > 0 && (
                                <div className="mb-3">
                                    <h6 className="fw-bold text-uppercase tracking-wider" style={{ color: resumeData.accent_color }}>Languages</h6>
                                    <p className="text-xs mb-0">
                                        {resumeData.custom_sections.langs.map((l) => l.name).join(', ')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Summary Suggestion Modal */}
            {aiSummaryModal && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content card-premium text-white border-0 shadow-lg">
                            <div className="modal-header border-bottom border-secondary border-opacity-25">
                                <h5 className="modal-title fw-bold"><i className="bi bi-magic text-primary me-2"></i>AI Auto-Write Professional Summary</h5>
                                <button className="btn-close btn-close-white" onClick={() => setAiSummaryModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                {loadingSummary ? (
                                    <p className="text-muted text-xs">Generating 3 executive summary choices using Groq Llama-3 AI...</p>
                                ) : summaryOptions ? (
                                    <div className="d-flex flex-column gap-3">
                                        {['executive', 'modern', 'creative'].map((type) => (
                                            <div key={type} className="p-3 border border-secondary border-opacity-25 rounded bg-dark">
                                                <h6 className="fw-bold text-primary text-uppercase text-xs mb-2">{type} Tone</h6>
                                                <p className="text-xs text-muted mb-2">{summaryOptions[type]}</p>
                                                <button
                                                    className="btn btn-xs btn-primary-custom"
                                                    onClick={() => {
                                                        setResumeData({
                                                            ...resumeData,
                                                            personal: { ...resumeData.personal, summary: summaryOptions[type] }
                                                        });
                                                        setAiSummaryModal(false);
                                                    }}
                                                >
                                                    Use This Summary
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted text-xs">Failed to load AI suggestions.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

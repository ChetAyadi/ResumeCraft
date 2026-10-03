import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export const ChatbotWidget = () => {
    const { user, apiFetch } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hi there! I am your AI Career Advisor. Ask me anything about tailoring your resume, optimizing ATS keywords, or preparing for interviews!' }
    ]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    if (!user) return null;

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput('');
        setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
        setLoading(true);

        // Read page context if available
        let jobDesc = '';
        let resumeText = '';

        const jobInput = document.getElementById('jobDescription');
        if (jobInput) jobDesc = jobInput.value;

        try {
            const history = messages.map(m => ({ role: m.role, content: m.content }));
            const response = await apiFetch('/api/chatbot/chat/', {
                method: 'POST',
                body: JSON.stringify({
                    message: userMsg,
                    history: history,
                    job_description: jobDesc,
                    resume_text: resumeText
                })
            });

            if (response.ok) {
                const data = await response.json();
                setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
            } else {
                setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an issue connecting to the AI advisor service.' }]);
            }
        } catch (err) {
            console.error('Chatbot API error:', err);
            setMessages((prev) => [...prev, { role: 'assistant', content: 'Server connection error during response generation.' }]);
        } finally {
            setLoading(false);
        }
    };

    const renderFormattedText = (text) => {
        if (!text) return '';
        let formatted = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br/>');
        return { __html: formatted };
    };

    return (
        <>
            <div className="chatbot-bubble" onClick={() => setIsOpen(!isOpen)} title="AI Career Advisor">
                <i className={`bi ${isOpen ? 'bi-x-lg' : 'bi-robot'}`}></i>
            </div>

            {isOpen && (
                <div className="chatbot-window shadow-lg">
                    <div className="chatbot-header">
                        <h6>
                            <i className="bi bi-cpu-fill text-primary"></i>
                            <span>AI Career Advisor</span>
                        </h6>
                        <button onClick={() => setIsOpen(false)}>
                            <i className="bi bi-x-lg"></i>
                        </button>
                    </div>

                    <div className="chatbot-messages p-3 d-flex flex-column gap-3">
                        {messages.map((msg, index) => (
                            <div key={index} className={`chat-msg ${msg.role === 'user' ? 'user' : 'ai'}`}>
                                <div dangerouslySetInnerHTML={renderFormattedText(msg.content)} />
                            </div>
                        ))}
                        {loading && (
                            <div className="chat-loading">
                                <span></span><span></span><span></span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="chatbot-input-container">
                        <form className="chatbot-form" onSubmit={handleSend}>
                            <input
                                type="text"
                                className="chatbot-input"
                                placeholder="Ask about resume tips, ATS..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                            />
                            <button type="submit" className="chatbot-send" disabled={loading || !input.trim()}>
                                <i className="bi bi-send-fill"></i>
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

import React from 'react';
import { X, MessageCircle, ThumbsUp } from 'lucide-react';

const FeedbackModal = ({ data, onClose, onImprove, isImproving }) => {
    if (!data) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60
        }}>
            <div style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                borderRadius: '12px',
                padding: '2rem',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-color)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                        <MessageCircle size={28} />
                        Audience Feedback
                    </h2>
                    <button onClick={onClose} style={{ border: 'none', background: 'transparent', padding: 0, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                        Target Audience Thoughts
                    </h3>
                    <div style={{
                        backgroundColor: 'var(--bg-secondary)',
                        padding: '1rem',
                        borderRadius: '8px',
                        borderLeft: '4px solid var(--text-primary)',
                        fontStyle: 'italic',
                        fontSize: '1.05rem',
                        lineHeight: '1.6',
                        color: 'var(--text-primary)'
                    }}>
                        "{data.thoughts}"
                    </div>
                </div>

                <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                        Actionable Improvements
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {data.improvements.map((imp, i) => (
                            <li key={i} style={{
                                marginBottom: '0.75rem',
                                display: 'flex',
                                gap: '0.75rem',
                                alignItems: 'flex-start',
                                color: 'var(--text-primary)'
                            }}>
                                <ThumbsUp size={18} color="var(--text-tertiary)" style={{ marginTop: '0.25rem' }} />
                                <span>{imp}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-color)',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '6px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>

                    <button
                        onClick={onImprove}
                        disabled={isImproving}
                        style={{
                            backgroundColor: 'var(--text-primary)',
                            color: 'var(--bg-primary)',
                            border: 'none',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '6px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: isImproving ? 'not-allowed' : 'pointer',
                            opacity: isImproving ? 0.7 : 1
                        }}
                    >
                        {isImproving ? 'Improving...' : 'Improve based on this'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FeedbackModal;

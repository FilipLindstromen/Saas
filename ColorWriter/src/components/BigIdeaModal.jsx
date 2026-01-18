import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

const BigIdeaModal = ({ suggestions, onClose, onSelect }) => {
    const [selectedIndex, setSelectedIndex] = useState(null);

    if (!suggestions || !suggestions.ideas) return null;

    const handleSelect = (idea) => {
        onSelect(idea);
        onClose();
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
        }}>
            <div style={{
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '12px',
                maxWidth: '700px',
                width: '100%',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-color)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'var(--bg-primary)',
                    zIndex: 1
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Big Idea Suggestions
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            color: 'var(--text-tertiary)',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '1.5rem' }}>
                    <p style={{
                        color: 'var(--text-secondary)',
                        marginBottom: '1.5rem',
                        fontSize: '0.95rem',
                        lineHeight: '1.6'
                    }}>
                        Select one of these big ideas to drive your entire copy. Each idea is designed to be memorable, unique, and compelling.
                    </p>

                    {suggestions.ideas.map((item, idx) => (
                        <div key={idx} style={{
                            marginBottom: '1.25rem',
                            padding: '1.25rem',
                            backgroundColor: selectedIndex === idx ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                            borderRadius: '8px',
                            border: selectedIndex === idx ? '2px solid var(--color-cta-text)' : '1px solid var(--border-color)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative'
                        }}
                            onClick={() => setSelectedIndex(idx)}
                            onMouseEnter={(e) => {
                                if (selectedIndex !== idx) {
                                    e.currentTarget.style.borderColor = 'var(--text-tertiary)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (selectedIndex !== idx) {
                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                }
                            }}
                        >
                            <div style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: 'var(--text-tertiary)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: '0.5rem'
                            }}>
                                Big Idea #{idx + 1}
                            </div>
                            <div style={{
                                fontSize: '1.05rem',
                                color: 'var(--text-primary)',
                                marginBottom: '0.75rem',
                                fontWeight: 600,
                                lineHeight: '1.4'
                            }}>
                                "{item.idea}"
                            </div>
                            <div style={{
                                fontSize: '0.875rem',
                                color: 'var(--text-secondary)',
                                lineHeight: '1.5'
                            }}>
                                {item.explanation}
                            </div>

                            {selectedIndex === idx && (
                                <button
                                    onClick={() => handleSelect(item.idea)}
                                    style={{
                                        marginTop: '1rem',
                                        width: '100%',
                                        padding: '0.75rem',
                                        backgroundColor: 'var(--color-cta-text)',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <Check size={16} />
                                    Use This Big Idea
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default BigIdeaModal;

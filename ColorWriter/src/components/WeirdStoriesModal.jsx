import React, { useState } from 'react';
import { X, ExternalLink, Loader2 } from 'lucide-react';

const WeirdStoriesModal = ({ stories, onClose, onGenerateCopy, loading }) => {
    const [selectedStoryIndex, setSelectedStoryIndex] = useState(null);

    if (!stories || !stories.length) return null;

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
                maxWidth: '900px',
                width: '100%',
                maxHeight: '85vh',
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
                        Weird Story Ideas
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
                        Select a weird story to generate copy based on it. Each story is verified as true and includes a source link.
                    </p>

                    {stories.map((story, idx) => (
                        <div key={idx} style={{
                            marginBottom: '1.5rem',
                            padding: '1.5rem',
                            backgroundColor: selectedStoryIndex === idx ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                            borderRadius: '8px',
                            border: selectedStoryIndex === idx ? '2px solid var(--color-cta-text)' : '1px solid var(--border-color)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative'
                        }}
                            onClick={() => setSelectedStoryIndex(idx)}
                            onMouseEnter={(e) => {
                                if (selectedStoryIndex !== idx) {
                                    e.currentTarget.style.borderColor = 'var(--text-tertiary)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (selectedStoryIndex !== idx) {
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
                                marginBottom: '0.75rem'
                            }}>
                                Story #{idx + 1}
                            </div>
                            <div style={{
                                fontSize: '1.05rem',
                                color: 'var(--text-primary)',
                                marginBottom: '1rem',
                                fontWeight: 600,
                                lineHeight: '1.5'
                            }}>
                                {story.title}
                            </div>
                            <div style={{
                                fontSize: '0.9rem',
                                color: 'var(--text-secondary)',
                                lineHeight: '1.6',
                                marginBottom: '1rem'
                            }}>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>The Story:</strong> {story.story || story.summary}
                                </div>
                                {story.whyStrange && (
                                    <div style={{ marginBottom: '0.75rem', paddingLeft: '1rem', borderLeft: '3px solid var(--color-ad-text)' }}>
                                        <strong style={{ color: 'var(--text-primary)' }}>Why It's Strange:</strong> {story.whyStrange}
                                    </div>
                                )}
                                {story.whyMatters && (
                                    <div style={{ marginBottom: '0.75rem', paddingLeft: '1rem', borderLeft: '3px solid var(--color-logic-text)' }}>
                                        <strong style={{ color: 'var(--text-primary)' }}>Why It Matters:</strong> {story.whyMatters}
                                    </div>
                                )}
                                {story.hook && (
                                    <div style={{ 
                                        marginTop: '1rem', 
                                        padding: '0.75rem', 
                                        backgroundColor: 'var(--bg-tertiary)', 
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <div style={{ 
                                            fontSize: '0.75rem', 
                                            fontWeight: 600, 
                                            color: 'var(--text-tertiary)', 
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: '0.5rem'
                                        }}>
                                            Ad Hook
                                        </div>
                                        <div style={{ 
                                            fontSize: '0.95rem', 
                                            color: 'var(--text-primary)', 
                                            fontStyle: 'italic',
                                            fontWeight: 500
                                        }}>
                                            "{story.hook}"
                                        </div>
                                    </div>
                                )}
                            </div>
                            {story.source && (
                                <div style={{
                                    marginBottom: '1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <a
                                        href={story.source}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            fontSize: '0.85rem',
                                            color: 'var(--color-cta-text)',
                                            textDecoration: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem'
                                        }}
                                    >
                                        <ExternalLink size={14} />
                                        View Source
                                    </a>
                                </div>
                            )}

                            {selectedStoryIndex === idx && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onGenerateCopy(story);
                                    }}
                                    disabled={loading}
                                    style={{
                                        marginTop: '0.5rem',
                                        width: '100%',
                                        padding: '0.75rem',
                                        backgroundColor: loading ? 'var(--bg-tertiary)' : 'var(--color-cta-text)',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        opacity: loading ? 0.7 : 1
                                    }}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="animate-spin" size={16} />
                                            Generating Copy...
                                        </>
                                    ) : (
                                        'Generate Copy from This Story'
                                    )}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WeirdStoriesModal;

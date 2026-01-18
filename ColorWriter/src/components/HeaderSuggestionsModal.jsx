import React from 'react';
import { X, Copy, Check } from 'lucide-react';

const HeaderSuggestionsModal = ({ suggestions, onClose }) => {
    const [copiedIndex, setCopiedIndex] = React.useState(null);

    if (!suggestions) return null;

    const copyToClipboard = (text, index) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
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
                        Header & Subheader Suggestions
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
                    {suggestions.suggestions?.map((item, idx) => (
                        <div key={idx} style={{
                            marginBottom: '2rem',
                            padding: '1.5rem',
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: '8px',
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
                                Current Header
                            </div>
                            <div style={{
                                fontSize: '1rem',
                                color: 'var(--text-secondary)',
                                marginBottom: '1rem',
                                fontStyle: 'italic'
                            }}>
                                "{item.original}"
                            </div>

                            <div style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: 'var(--text-tertiary)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: '0.75rem'
                            }}>
                                Better Alternatives
                            </div>

                            {item.alternatives?.map((alt, altIdx) => (
                                <div key={altIdx} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.75rem',
                                    marginBottom: '0.5rem',
                                    backgroundColor: 'var(--bg-tertiary)',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <span style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                                        {alt}
                                    </span>
                                    <button
                                        onClick={() => copyToClipboard(alt, `${idx}-${altIdx}`)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '0.25rem',
                                            color: copiedIndex === `${idx}-${altIdx}` ? 'var(--color-cta-text)' : 'var(--text-tertiary)',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                        title="Copy to clipboard"
                                    >
                                        {copiedIndex === `${idx}-${altIdx}` ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                            ))}

                            <div style={{
                                marginTop: '1rem',
                                padding: '0.75rem',
                                backgroundColor: 'var(--bg-tertiary)',
                                borderRadius: '6px',
                                fontSize: '0.85rem',
                                color: 'var(--text-secondary)',
                                borderLeft: '3px solid var(--color-cta-text)'
                            }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Why better:</strong> {item.why_better}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default HeaderSuggestionsModal;

import React, { useState, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { DEFAULT_MASTER_PROMPT } from '../services/openai';

const MasterPromptModal = ({ isOpen, onClose, promptValue, onSave }) => {
    const [value, setValue] = useState(promptValue || DEFAULT_MASTER_PROMPT);

    useEffect(() => {
        if (isOpen) {
            setValue(promptValue || DEFAULT_MASTER_PROMPT);
        }
    }, [isOpen, promptValue]);

    const handleReset = () => {
        if (confirm('Reset to default master prompt? Your edits will be lost.')) {
            setValue(DEFAULT_MASTER_PROMPT);
        }
    };

    const handleSave = () => {
        onSave(value);
        onClose();
    };

    if (!isOpen) return null;

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
                padding: '1.5rem',
                maxWidth: '900px',
                width: '95%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-default)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        Master Prompt
                    </h2>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                            onClick={handleReset}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.8rem',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-default)',
                                borderRadius: '6px',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer'
                            }}
                            title="Reset to default"
                        >
                            <RotateCcw size={14} />
                            Reset to Default
                        </button>
                        <button
                            onClick={handleSave}
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                background: 'var(--accent-gradient)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer'
                            }}
                        >
                            Save
                        </button>
                        <button
                            onClick={onClose}
                            style={{ border: 'none', background: 'transparent', padding: 0, color: 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.75rem' }}>
                    Use placeholders: {'{{offerType}}'}, {'{{targetAudience}}'}, {'{{s1}}'}-{'{{s5}}'}, {'{{p1}}'}-{'{{p3}}'}, {'{{h1}}'}, {'{{h2}}'}, {'{{o1}}'}-{'{{o3}}'}, {'{{obj1}}'}-{'{{obj4}}'}, {'{{oldBelief}}'}, {'{{newBelief}}'}, {'{{desiredEmotion}}'}, {'{{primaryCta}}'}, {'{{docTypeExtension}}'}
                </p>
                <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    style={{
                        flex: 1,
                        minHeight: '400px',
                        width: '100%',
                        padding: '1rem',
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        lineHeight: 1.5,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        resize: 'vertical'
                    }}
                    spellCheck={false}
                />
            </div>
        </div>
    );
};

export default MasterPromptModal;

import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

const FIELD_LABELS = {
    targetAudience: 'Target Audience',
    situationsList: 'Specific Situations',
    painPoints: 'Pain Patterns',
    hiddenFrustrations: 'Hidden Frustrations',
    desiredOutcomes: 'Desired Outcomes',
    objections: 'Common Objections',
    oldBelief: 'Old Belief',
    newBelief: 'New Belief',
    desiredEmotion: 'Desired Emotion After Reading',
    primaryCta: 'Primary CTA'
};

const ImproveInputsModal = ({ isOpen, onClose, suggestions, onApply }) => {
    const [selections, setSelections] = useState({});

    if (!isOpen) return null;

    const fieldsWithSuggestions = Object.entries(suggestions || {}).filter(
        ([_, opts]) => Array.isArray(opts) && opts.length > 0
    );

    const handleSelect = (fieldKey, index) => {
        setSelections(prev => ({
            ...prev,
            [fieldKey]: suggestions[fieldKey][index]
        }));
    };

    const handleApply = () => {
        onApply(selections);
        setSelections({});
        onClose();
    };

    const handleClose = () => {
        setSelections({});
        onClose();
    };

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
                maxWidth: '560px',
                width: '95%',
                maxHeight: '85vh',
                overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-default)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                        Choose suggestions for empty fields
                    </h2>
                    <button
                        onClick={handleClose}
                        style={{ border: 'none', background: 'transparent', padding: 0, color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                        <X size={24} />
                    </button>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>
                    Select one suggestion per field to fill in. Click a suggestion to select it.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {fieldsWithSuggestions.map(([fieldKey, opts]) => (
                        <div key={fieldKey}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                                {FIELD_LABELS[fieldKey] || fieldKey}
                            </label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {opts.map((opt, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleSelect(fieldKey, idx)}
                                        style={{
                                            textAlign: 'left',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '8px',
                                            border: `2px solid ${selections[fieldKey] === opt ? 'var(--bg-hover)' : 'var(--border-default)'}`,
                                            background: selections[fieldKey] === opt ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-secondary)',
                                            color: 'var(--text-primary)',
                                            cursor: 'pointer',
                                            fontSize: '0.875rem',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        {selections[fieldKey] === opt && <Check size={16} style={{ flexShrink: 0, marginTop: '2px' }} />}
                                        <span>{opt}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-default)' }}>
                    <button
                        onClick={handleClose}
                        style={{
                            padding: '0.5rem 1rem',
                            fontSize: '0.875rem',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-default)',
                            borderRadius: '6px',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={Object.keys(selections).length === 0}
                        style={{
                            padding: '0.5rem 1rem',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            background: Object.keys(selections).length > 0 ? 'var(--bg-hover)' : 'var(--bg-tertiary)',
                            color: Object.keys(selections).length > 0 ? '#fff' : 'var(--text-tertiary)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: Object.keys(selections).length > 0 ? 'pointer' : 'not-allowed'
                        }}
                    >
                        Apply selected
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImproveInputsModal;

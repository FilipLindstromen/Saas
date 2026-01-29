import React from 'react';
import { X, Eye, FlaskConical, Sparkles, Loader2, Wand2 } from 'lucide-react';

const ThreeRulesModal = ({ data, onClose, onImprove, isImproving }) => {
    if (!data) return null;

    const getScoreColor = (score) => {
        if (score >= 85) return '#10b981'; // green-500
        if (score >= 70) return '#3b82f6'; // blue-500
        if (score >= 50) return '#f59e0b'; // amber-500
        return '#ef4444'; // red-500
    };

    const getScoreLabel = (score) => {
        if (score >= 85) return 'Excellent';
        if (score >= 70) return 'Good';
        if (score >= 50) return 'Needs Work';
        return 'Weak';
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
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '2rem',
                maxWidth: '700px',
                width: '90%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Sparkles size={28} />
                        Three Rules Analysis
                    </h2>
                    <button onClick={onClose} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Overall Score */}
                <div style={{
                    backgroundColor: '#f3f4f6',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    marginBottom: '2rem',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Overall Score
                    </div>
                    <div style={{ fontSize: '3rem', fontWeight: 800, color: getScoreColor(data.overall_score), marginBottom: '0.5rem' }}>
                        {data.overall_score}/100
                    </div>
                    <div style={{ fontSize: '1rem', color: '#374151', fontWeight: 500 }}>
                        {data.overall_feedback}
                    </div>
                </div>

                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    {/* 1. Visualization */}
                    <div style={{
                        border: `2px solid ${getScoreColor(data.visualization.score)}`,
                        borderRadius: '8px',
                        padding: '1.5rem',
                        backgroundColor: '#fafafa'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <Eye size={24} style={{ color: getScoreColor(data.visualization.score) }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                    1. Can You Visualize It? 👀
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: getScoreColor(data.visualization.score) }}>
                                        {data.visualization.score}/100
                                    </div>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: getScoreColor(data.visualization.score) }}>
                                        {getScoreLabel(data.visualization.score)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.95rem', color: '#374151', lineHeight: '1.6', marginBottom: '1rem' }}>
                            {data.visualization.feedback}
                        </div>
                        {data.visualization.examples && data.visualization.examples.length > 0 && (
                            <div style={{ marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem' }}>
                                    Examples:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                                    {data.visualization.examples.map((example, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem', fontStyle: 'italic' }}>"{example}"</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {data.visualization.strengths && data.visualization.strengths.length > 0 && (
                            <div style={{ marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#059669', marginBottom: '0.5rem' }}>
                                    Strengths:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                                    {data.visualization.strengths.map((strength, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{strength}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {data.visualization.weaknesses && data.visualization.weaknesses.length > 0 && (
                            <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.5rem' }}>
                                    Weaknesses:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                                    {data.visualization.weaknesses.map((weakness, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{weakness}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* 2. Falsifiability */}
                    <div style={{
                        border: `2px solid ${getScoreColor(data.falsifiability.score)}`,
                        borderRadius: '8px',
                        padding: '1.5rem',
                        backgroundColor: '#fafafa'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <FlaskConical size={24} style={{ color: getScoreColor(data.falsifiability.score) }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                    2. Can You Falsify It? 🧪
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: getScoreColor(data.falsifiability.score) }}>
                                        {data.falsifiability.score}/100
                                    </div>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: getScoreColor(data.falsifiability.score) }}>
                                        {getScoreLabel(data.falsifiability.score)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.95rem', color: '#374151', lineHeight: '1.6', marginBottom: '1rem' }}>
                            {data.falsifiability.feedback}
                        </div>
                        {data.falsifiability.examples && data.falsifiability.examples.length > 0 && (
                            <div style={{ marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem' }}>
                                    Examples:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                                    {data.falsifiability.examples.map((example, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem', fontStyle: 'italic' }}>"{example}"</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {data.falsifiability.strengths && data.falsifiability.strengths.length > 0 && (
                            <div style={{ marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#059669', marginBottom: '0.5rem' }}>
                                    Strengths:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                                    {data.falsifiability.strengths.map((strength, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{strength}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {data.falsifiability.weaknesses && data.falsifiability.weaknesses.length > 0 && (
                            <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.5rem' }}>
                                    Weaknesses:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                                    {data.falsifiability.weaknesses.map((weakness, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{weakness}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* 3. Originality */}
                    <div style={{
                        border: `2px solid ${getScoreColor(data.originality.score)}`,
                        borderRadius: '8px',
                        padding: '1.5rem',
                        backgroundColor: '#fafafa'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <Sparkles size={24} style={{ color: getScoreColor(data.originality.score) }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                    3. Can Nobody Else Say It? 🧬
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: getScoreColor(data.originality.score) }}>
                                        {data.originality.score}/100
                                    </div>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: getScoreColor(data.originality.score) }}>
                                        {getScoreLabel(data.originality.score)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.95rem', color: '#374151', lineHeight: '1.6', marginBottom: '1rem' }}>
                            {data.originality.feedback}
                        </div>
                        {data.originality.examples && data.originality.examples.length > 0 && (
                            <div style={{ marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem' }}>
                                    Examples:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                                    {data.originality.examples.map((example, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem', fontStyle: 'italic' }}>"{example}"</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {data.originality.strengths && data.originality.strengths.length > 0 && (
                            <div style={{ marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#059669', marginBottom: '0.5rem' }}>
                                    Strengths:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                                    {data.originality.strengths.map((strength, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{strength}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {data.originality.weaknesses && data.originality.weaknesses.length > 0 && (
                            <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.5rem' }}>
                                    Weaknesses:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                                    {data.originality.weaknesses.map((weakness, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{weakness}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button
                        onClick={onImprove}
                        disabled={isImproving}
                        style={{
                            backgroundColor: '#111827',
                            color: 'white',
                            border: 'none',
                            padding: '0.75rem 1.5rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: isImproving ? 'not-allowed' : 'pointer',
                            opacity: isImproving ? 0.6 : 1
                        }}
                    >
                        {isImproving ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
                        {isImproving ? 'Improving...' : 'Improve Copy Based on These Rules'}
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            backgroundColor: '#ffffff',
                            color: '#111827',
                            border: '1px solid #e5e7eb',
                            padding: '0.75rem 1.5rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ThreeRulesModal;

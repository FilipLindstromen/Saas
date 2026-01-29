import React from 'react';
import { X, Target, Cog, Heart, Lightbulb, TrendingUp, Loader2, Wand2 } from 'lucide-react';

const ThreeKeyIngredientsModal = ({ data, onClose, onImprove, isImproving }) => {
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
                        <TrendingUp size={28} />
                        Four Key Ingredients Analysis
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
                    {/* 1. Deep Understanding */}
                    <div style={{
                        border: `2px solid ${getScoreColor(data.understanding.score)}`,
                        borderRadius: '8px',
                        padding: '1.5rem',
                        backgroundColor: '#fafafa'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <Target size={24} style={{ color: getScoreColor(data.understanding.score) }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                    1. Deep, Precise Understanding of the Reader
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: getScoreColor(data.understanding.score) }}>
                                        {data.understanding.score}/100
                                    </div>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: getScoreColor(data.understanding.score) }}>
                                        {getScoreLabel(data.understanding.score)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.95rem', color: '#374151', lineHeight: '1.6', marginBottom: '1rem' }}>
                            {data.understanding.feedback}
                        </div>
                        {data.understanding.strengths && data.understanding.strengths.length > 0 && (
                            <div style={{ marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#059669', marginBottom: '0.5rem' }}>
                                    Strengths:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                                    {data.understanding.strengths.map((strength, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{strength}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {data.understanding.weaknesses && data.understanding.weaknesses.length > 0 && (
                            <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.5rem' }}>
                                    Weaknesses:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                                    {data.understanding.weaknesses.map((weakness, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{weakness}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* 2. Clear Mechanism */}
                    <div style={{
                        border: `2px solid ${getScoreColor(data.mechanism.score)}`,
                        borderRadius: '8px',
                        padding: '1.5rem',
                        backgroundColor: '#fafafa'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <Cog size={24} style={{ color: getScoreColor(data.mechanism.score) }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                    2. Clear, Believable Mechanism
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: getScoreColor(data.mechanism.score) }}>
                                        {data.mechanism.score}/100
                                    </div>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: getScoreColor(data.mechanism.score) }}>
                                        {getScoreLabel(data.mechanism.score)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.95rem', color: '#374151', lineHeight: '1.6', marginBottom: '1rem' }}>
                            {data.mechanism.feedback}
                        </div>
                        {data.mechanism.strengths && data.mechanism.strengths.length > 0 && (
                            <div style={{ marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#059669', marginBottom: '0.5rem' }}>
                                    Strengths:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                                    {data.mechanism.strengths.map((strength, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{strength}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {data.mechanism.weaknesses && data.mechanism.weaknesses.length > 0 && (
                            <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.5rem' }}>
                                    Weaknesses:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                                    {data.mechanism.weaknesses.map((weakness, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{weakness}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* 3. Emotional Movement */}
                    <div style={{
                        border: `2px solid ${getScoreColor(data.emotional_movement.score)}`,
                        borderRadius: '8px',
                        padding: '1.5rem',
                        backgroundColor: '#fafafa'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <Heart size={24} style={{ color: getScoreColor(data.emotional_movement.score) }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                    3. Emotional Movement → Relief
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: getScoreColor(data.emotional_movement.score) }}>
                                        {data.emotional_movement.score}/100
                                    </div>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: getScoreColor(data.emotional_movement.score) }}>
                                        {getScoreLabel(data.emotional_movement.score)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.95rem', color: '#374151', lineHeight: '1.6', marginBottom: '1rem' }}>
                            {data.emotional_movement.feedback}
                        </div>
                        {data.emotional_movement.strengths && data.emotional_movement.strengths.length > 0 && (
                            <div style={{ marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#059669', marginBottom: '0.5rem' }}>
                                    Strengths:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                                    {data.emotional_movement.strengths.map((strength, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{strength}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {data.emotional_movement.weaknesses && data.emotional_movement.weaknesses.length > 0 && (
                            <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.5rem' }}>
                                    Weaknesses:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                                    {data.emotional_movement.weaknesses.map((weakness, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{weakness}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* 4. The Big Idea */}
                    <div style={{
                        border: `2px solid ${getScoreColor(data.big_idea?.score || 0)}`,
                        borderRadius: '8px',
                        padding: '1.5rem',
                        backgroundColor: '#fafafa'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <Lightbulb size={24} style={{ color: getScoreColor(data.big_idea?.score || 0) }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                    4. The Big Idea
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: getScoreColor(data.big_idea?.score || 0) }}>
                                        {data.big_idea?.score || 0}/100
                                    </div>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: getScoreColor(data.big_idea?.score || 0) }}>
                                        {getScoreLabel(data.big_idea?.score || 0)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.95rem', color: '#374151', lineHeight: '1.6', marginBottom: '1rem' }}>
                            {data.big_idea?.feedback || 'Analysis not available'}
                        </div>
                        {data.big_idea?.strengths && data.big_idea.strengths.length > 0 && (
                            <div style={{ marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#059669', marginBottom: '0.5rem' }}>
                                    Strengths:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                                    {data.big_idea.strengths.map((strength, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem' }}>{strength}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {data.big_idea?.weaknesses && data.big_idea.weaknesses.length > 0 && (
                            <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.5rem' }}>
                                    Weaknesses:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#374151' }}>
                                    {data.big_idea.weaknesses.map((weakness, idx) => (
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
                            backgroundColor: '#ffffff',
                            color: '#111827',
                            border: '1px solid #e5e7eb',
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
                        {isImproving ? 'Improving...' : 'Improve Copy Based on This'}
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            backgroundColor: '#111827',
                            color: 'white',
                            border: 'none',
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

export default ThreeKeyIngredientsModal;

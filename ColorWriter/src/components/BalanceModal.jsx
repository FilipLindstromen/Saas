import React from 'react';
import { X, Scale, ArrowUpCircle, ArrowDownCircle, Lightbulb, Wand2, Loader2 } from 'lucide-react';

const BalanceModal = ({ data, onClose, onImprove, isImproving }) => {
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
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '2rem',
                maxWidth: '500px',
                width: '90%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Scale size={28} />
                        Color Balance
                    </h2>
                    <button onClick={onClose} style={{ border: 'none', background: 'transparent', padding: 0 }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ display: 'grid', gap: '1.5rem' }}>

                    {/* Over Represented */}
                    <div style={{
                        backgroundColor: '#fee2e2',
                        padding: '1rem',
                        borderRadius: '8px',
                        border: '1px solid #fecaca'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#991b1b', fontWeight: 700 }}>
                            <ArrowUpCircle size={20} />
                            Over-Represented
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.25rem', color: '#7f1d1d' }}>
                            {data.over_represented.item}
                        </div>
                        <p style={{ fontSize: '0.9rem', color: '#7f1d1d', margin: 0 }}>
                            {data.over_represented.reason}
                        </p>
                    </div>

                    {/* Lacking */}
                    <div style={{
                        backgroundColor: '#dcfce7',
                        padding: '1rem',
                        borderRadius: '8px',
                        border: '1px solid #bbf7d0'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#166534', fontWeight: 700 }}>
                            <ArrowDownCircle size={20} />
                            Lacking
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.25rem', color: '#14532d' }}>
                            {data.lacking.item}
                        </div>
                        <p style={{ fontSize: '0.9rem', color: '#14532d', margin: 0 }}>
                            {data.lacking.reason}
                        </p>
                    </div>

                    {/* Suggestion */}
                    <div style={{ padding: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                        <Lightbulb size={20} style={{ marginTop: '0.1rem', color: 'var(--text-tertiary)' }} />
                        <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            {data.suggestion}
                        </span>
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
                            gap: '0.5rem'
                        }}
                    >
                        {isImproving ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
                        {isImproving ? 'Improving...' : 'Improve text based on this'}
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            backgroundColor: '#111827',
                            color: 'white',
                            border: 'none',
                            padding: '0.75rem 1.5rem',
                            fontWeight: 600,
                            borderRadius: '6px'
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BalanceModal;

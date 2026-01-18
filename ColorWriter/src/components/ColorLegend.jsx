import React from 'react';

// Reusable item for consistent visuals
const LegendItem = ({ label, color, subtitle, type, iconStart, iconEnd, isActive, isDimmed }) => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '0.75rem',
        opacity: isDimmed ? 0.3 : 1, // Dim if something else is active
        transform: isActive ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 0.2s ease',
        fontWeight: isActive ? 600 : 400
    }}>
        <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            backgroundColor: color, // Handles background for Blocks
            border: '1px solid rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '0.75rem',
            fontSize: '1.1rem',
            boxShadow: isActive ? '0 0 0 2px var(--text-primary)' : 'none', // Highlight ring
            flexShrink: 0
        }}>
            {/* Some items have icons instead of just color bg */}
            {type === 'homer' && '🍩'}
            {type === 'bart' && '⚡'}
            {type === 'marge' && '💙'}
            {type === 'lisa' && '📊'}
            {type === 'interrupt' && '🛑'}
            {type === 'loop-open' && '➰'}
            {type === 'loop-close' && '✅'}
        </div>
        <div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{label}</div>
            {subtitle && <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{subtitle}</div>}
        </div>
    </div>
);

const ColorLegend = ({ activeItem }) => {
    // If activeItem exists, everything else is dimmed
    const isAnyActive = !!activeItem;

    const checkActive = (key) => activeItem === key;
    const checkDimmed = (key) => isAnyActive && activeItem !== key;

    return (
        <div style={{ padding: '0 0.5rem' }}>
            {/* BLOCKS */}
            <h4 style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                marginBottom: '1rem',
                letterSpacing: '0.05em'
            }}>
                Block Types
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <LegendItem label="Hook" color="var(--color-hook)" isActive={checkActive('hook')} isDimmed={checkDimmed('hook')} />
                <LegendItem label="Story" color="var(--color-story)" isActive={checkActive('story')} isDimmed={checkDimmed('story')} />
                <LegendItem label="Emotions" color="var(--color-emotion)" isActive={checkActive('emotion')} isDimmed={checkDimmed('emotion')} />
                <LegendItem label="Logic" color="var(--color-logic)" isActive={checkActive('logic')} isDimmed={checkDimmed('logic')} />
                <LegendItem label="Proof" color="var(--color-proof)" isActive={checkActive('proof')} isDimmed={checkDimmed('proof')} />
                <LegendItem label="CTA" color="var(--color-cta)" isActive={checkActive('cta')} isDimmed={checkDimmed('cta')} />
                <LegendItem label="Ad / Creative" color="var(--color-ad)" isActive={checkActive('ad')} isDimmed={checkDimmed('ad')} />
                <LegendItem label="Misc" color="var(--color-misc)" isActive={checkActive('misc')} isDimmed={checkDimmed('misc')} />
            </div>

            {/* PERSONAS */}
            <h4 style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                marginTop: '1.5rem',
                marginBottom: '1rem',
                letterSpacing: '0.05em'
            }}>
                Personas
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <LegendItem label="Homer" subtitle="Fun / Fails" color="#ffffff" type="homer" isActive={checkActive('homer')} isDimmed={checkDimmed('homer')} />
                <LegendItem label="Bart" subtitle="Fast / Urgent" color="#ffffff" type="bart" isActive={checkActive('bart')} isDimmed={checkDimmed('bart')} />
                <LegendItem label="Marge" subtitle="Connection" color="#ffffff" type="marge" isActive={checkActive('marge')} isDimmed={checkDimmed('marge')} />
                <LegendItem label="Lisa" subtitle="Logic / Data" color="#ffffff" type="lisa" isActive={checkActive('lisa')} isDimmed={checkDimmed('lisa')} />
            </div>

            {/* MECHANICS */}
            <h4 style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                marginTop: '1.5rem',
                marginBottom: '1rem',
                letterSpacing: '0.05em'
            }}>
                Mechanics
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <LegendItem label="Interrupt" color="#ffffff" type="interrupt" isActive={checkActive('interrupt')} isDimmed={checkDimmed('interrupt')} />
                <LegendItem label="Open Loop" color="#ffffff" type="loop-open" isActive={checkActive('loop-open')} isDimmed={checkDimmed('loop-open')} />
                <LegendItem label="Close Loop" color="#ffffff" type="loop-close" isActive={checkActive('loop-close')} isDimmed={checkDimmed('loop-close')} />
            </div>
        </div>
    );
};

export default ColorLegend;

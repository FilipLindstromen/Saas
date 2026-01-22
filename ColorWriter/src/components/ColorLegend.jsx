import React from 'react';

// Reusable item for consistent visuals
const LegendItem = ({ label, color, subtitle, type, iconStart, iconEnd, isActive, isDimmed, isSelected, onClick }) => (
    <div 
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '0.75rem',
            opacity: isDimmed ? 0.3 : 1, // Dim if something else is active
            transform: isActive || isSelected ? 'scale(1.02)' : 'scale(1)',
            transition: 'all 0.2s ease',
            fontWeight: isActive || isSelected ? 600 : 400,
            cursor: onClick ? 'pointer' : 'default',
            padding: onClick ? '0.25rem' : '0',
            borderRadius: onClick ? '4px' : '0',
            backgroundColor: isSelected ? 'var(--bg-secondary)' : 'transparent'
        }}
    >
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
            boxShadow: (isActive || isSelected) ? '0 0 0 2px var(--text-primary)' : 'none', // Highlight ring
            flexShrink: 0
        }}>
            {/* Show block type icons */}
            {type === 'hook' && '🎯'}
            {type === 'story' && '📖'}
            {type === 'emotion' && '❤️'}
            {type === 'logic' && '🧠'}
            {type === 'proof' && '✅'}
            {type === 'cta' && '🚀'}
            {type === 'ad' && '💡'}
            {type === 'misc' && '📝'}
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

const ColorLegend = ({ activeItem, selectedBlockType, onBlockTypeSelect }) => {
    // If activeItem exists, everything else is dimmed (for text selection highlighting)
    const isAnyActive = !!activeItem;
    
    // Block type selection (for filtering/fading)
    const handleBlockTypeClick = (type) => {
        if (onBlockTypeSelect) {
            // Toggle: if clicking the same type, deselect it
            if (selectedBlockType === type) {
                onBlockTypeSelect(null);
            } else {
                onBlockTypeSelect(type);
            }
        }
    };

    const checkActive = (key) => activeItem === key;
    const checkDimmed = (key) => isAnyActive && activeItem !== key;
    const checkSelected = (key) => selectedBlockType === key;

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
                <LegendItem label="Hook" color="var(--color-hook)" type="hook" isActive={checkActive('hook')} isDimmed={checkDimmed('hook')} isSelected={checkSelected('hook')} onClick={() => handleBlockTypeClick('hook')} />
                <LegendItem label="Story" color="var(--color-story)" type="story" isActive={checkActive('story')} isDimmed={checkDimmed('story')} isSelected={checkSelected('story')} onClick={() => handleBlockTypeClick('story')} />
                <LegendItem label="Emotions" color="var(--color-emotion)" type="emotion" isActive={checkActive('emotion')} isDimmed={checkDimmed('emotion')} isSelected={checkSelected('emotion')} onClick={() => handleBlockTypeClick('emotion')} />
                <LegendItem label="Logic" color="var(--color-logic)" type="logic" isActive={checkActive('logic')} isDimmed={checkDimmed('logic')} isSelected={checkSelected('logic')} onClick={() => handleBlockTypeClick('logic')} />
                <LegendItem label="Proof" color="var(--color-proof)" type="proof" isActive={checkActive('proof')} isDimmed={checkDimmed('proof')} isSelected={checkSelected('proof')} onClick={() => handleBlockTypeClick('proof')} />
                <LegendItem label="CTA" color="var(--color-cta)" type="cta" isActive={checkActive('cta')} isDimmed={checkDimmed('cta')} isSelected={checkSelected('cta')} onClick={() => handleBlockTypeClick('cta')} />
                <LegendItem label="Ad / Creative" color="var(--color-ad)" type="ad" isActive={checkActive('ad')} isDimmed={checkDimmed('ad')} isSelected={checkSelected('ad')} onClick={() => handleBlockTypeClick('ad')} />
                <LegendItem label="Misc" color="var(--color-misc)" type="misc" isActive={checkActive('misc')} isDimmed={checkDimmed('misc')} isSelected={checkSelected('misc')} onClick={() => handleBlockTypeClick('misc')} />
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

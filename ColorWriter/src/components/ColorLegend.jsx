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
            {type === 'statement' && '📌'}
            {type === 'impact' && '⚡'}
            {type === 'evidence' && '📋'}
            {type === 'relevance' && '🎯'}
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

// Persuasive Cycle: maps belief block types to persuasive types
const PERSUASIVE_MAP = {
    statement: ['hook', 'ad', 'statement'],
    impact: ['emotion', 'story', 'impact'],
    evidence: ['proof', 'logic', 'evidence'],
    relevance: ['cta', 'misc', 'relevance']
};

const ColorLegend = ({ activeItem, selectedBlockType, onBlockTypeSelect, colorScheme = 'belief' }) => {
    // If activeItem exists, everything else is dimmed (for text selection highlighting)
    const isAnyActive = !!activeItem;
    const isPersuasive = colorScheme === 'persuasive';

    // Resolve active/selected for persuasive mode (map belief types to persuasive)
    const resolveActive = (key) => {
        if (isPersuasive && PERSUASIVE_MAP[key]) {
            return activeItem && PERSUASIVE_MAP[key].includes(activeItem);
        }
        return activeItem === key;
    };
    const resolveDimmed = (key) => {
        if (isPersuasive && PERSUASIVE_MAP[key]) {
            return isAnyActive && !PERSUASIVE_MAP[key].includes(activeItem);
        }
        return isAnyActive && activeItem !== key;
    };
    const resolveSelected = (key) => selectedBlockType === key;

    // Block type selection (for filtering/fading)
    const handleBlockTypeClick = (type) => {
        if (onBlockTypeSelect) {
            if (selectedBlockType === type) {
                onBlockTypeSelect(null);
            } else {
                onBlockTypeSelect(type);
            }
        }
    };

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
                {isPersuasive ? 'Persuasive Cycle' : 'Block Types'}
            </h4>

            {isPersuasive ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <LegendItem label="Statement" color="var(--color-statement)" type="statement" isActive={resolveActive('statement')} isDimmed={resolveDimmed('statement')} isSelected={resolveSelected('statement')} onClick={() => handleBlockTypeClick('statement')} />
                    <LegendItem label="Impact" color="var(--color-impact)" type="impact" isActive={resolveActive('impact')} isDimmed={resolveDimmed('impact')} isSelected={resolveSelected('impact')} onClick={() => handleBlockTypeClick('impact')} />
                    <LegendItem label="Evidence" color="var(--color-evidence)" type="evidence" isActive={resolveActive('evidence')} isDimmed={resolveDimmed('evidence')} isSelected={resolveSelected('evidence')} onClick={() => handleBlockTypeClick('evidence')} />
                    <LegendItem label="Relevance" color="var(--color-relevance)" type="relevance" isActive={resolveActive('relevance')} isDimmed={resolveDimmed('relevance')} isSelected={resolveSelected('relevance')} onClick={() => handleBlockTypeClick('relevance')} />
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <LegendItem label="Hook" color="var(--color-hook)" type="hook" isActive={resolveActive('hook')} isDimmed={resolveDimmed('hook')} isSelected={resolveSelected('hook')} onClick={() => handleBlockTypeClick('hook')} />
                    <LegendItem label="Story" color="var(--color-story)" type="story" isActive={resolveActive('story')} isDimmed={resolveDimmed('story')} isSelected={resolveSelected('story')} onClick={() => handleBlockTypeClick('story')} />
                    <LegendItem label="Emotions" color="var(--color-emotion)" type="emotion" isActive={resolveActive('emotion')} isDimmed={resolveDimmed('emotion')} isSelected={resolveSelected('emotion')} onClick={() => handleBlockTypeClick('emotion')} />
                    <LegendItem label="Logic" color="var(--color-logic)" type="logic" isActive={resolveActive('logic')} isDimmed={resolveDimmed('logic')} isSelected={resolveSelected('logic')} onClick={() => handleBlockTypeClick('logic')} />
                    <LegendItem label="Proof" color="var(--color-proof)" type="proof" isActive={resolveActive('proof')} isDimmed={resolveDimmed('proof')} isSelected={resolveSelected('proof')} onClick={() => handleBlockTypeClick('proof')} />
                    <LegendItem label="CTA" color="var(--color-cta)" type="cta" isActive={resolveActive('cta')} isDimmed={resolveDimmed('cta')} isSelected={resolveSelected('cta')} onClick={() => handleBlockTypeClick('cta')} />
                    <LegendItem label="Ad / Creative" color="var(--color-ad)" type="ad" isActive={resolveActive('ad')} isDimmed={resolveDimmed('ad')} isSelected={resolveSelected('ad')} onClick={() => handleBlockTypeClick('ad')} />
                    <LegendItem label="Misc" color="var(--color-misc)" type="misc" isActive={resolveActive('misc')} isDimmed={resolveDimmed('misc')} isSelected={resolveSelected('misc')} onClick={() => handleBlockTypeClick('misc')} />
                </div>
            )}

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

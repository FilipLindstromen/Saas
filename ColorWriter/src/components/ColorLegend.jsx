import React from 'react';

const LegendItem = ({ label, color, type, isActive, isDimmed, isSelected, onClick }) => (
    <div 
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '0.75rem',
            opacity: isDimmed ? 0.3 : 1,
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
            backgroundColor: color,
            border: '1px solid rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '0.75rem',
            fontSize: '1.1rem',
            boxShadow: (isActive || isSelected) ? '0 0 0 2px var(--text-primary)' : 'none',
            flexShrink: 0
        }}>
            {type === 'statement' && '📌'}
            {type === 'impact' && '⚡'}
            {type === 'evidence' && '📋'}
            {type === 'relevance' && '🎯'}
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{label}</div>
    </div>
);

const ColorLegend = ({ activeItem, selectedBlockType, onBlockTypeSelect }) => {
    const isAnyActive = !!activeItem;

    const resolveActive = (key) => activeItem === key;
    const resolveDimmed = (key) => isAnyActive && activeItem !== key;
    const resolveSelected = (key) => selectedBlockType === key;

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
            <h4 style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                marginBottom: '1rem',
                letterSpacing: '0.05em'
            }}>
                Persuasive Cycle
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <LegendItem label="Statement" color="var(--color-statement)" type="statement" isActive={resolveActive('statement')} isDimmed={resolveDimmed('statement')} isSelected={resolveSelected('statement')} onClick={() => handleBlockTypeClick('statement')} />
                <LegendItem label="Impact" color="var(--color-impact)" type="impact" isActive={resolveActive('impact')} isDimmed={resolveDimmed('impact')} isSelected={resolveSelected('impact')} onClick={() => handleBlockTypeClick('impact')} />
                <LegendItem label="Evidence" color="var(--color-evidence)" type="evidence" isActive={resolveActive('evidence')} isDimmed={resolveDimmed('evidence')} isSelected={resolveSelected('evidence')} onClick={() => handleBlockTypeClick('evidence')} />
                <LegendItem label="Relevance" color="var(--color-relevance)" type="relevance" isActive={resolveActive('relevance')} isDimmed={resolveDimmed('relevance')} isSelected={resolveSelected('relevance')} onClick={() => handleBlockTypeClick('relevance')} />
            </div>
        </div>
    );
};

export default ColorLegend;

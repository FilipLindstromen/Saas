
import React, { useState } from 'react';
import { Settings, Zap, BookOpen, Smile, Brain, MousePointer2, Box, Loader2, MessageCircle, User, Scale } from 'lucide-react';
import ColorLegend from './ColorLegend';
import { generateCopy, analyzeAudienceFeedback } from '../services/openai';

const Sidebar = ({
    docType, setDocType,
    style, setStyle,
    instructions, setInstructions,
    targetAudience, setTargetAudience,
    onGenerated,
    onOpenSettings,
    apiKey,
    activeLegendItem,
    copywriter,
    setCopywriter
}) => {
    const [loading, setLoading] = useState(false);
    const [pimpLoading, setPimpLoading] = useState(false);

    const docTypes = [
        '📄 Sales Page',
        '📹 VSL',
        '📢 AD',
        '📘 Facebook Ad',
        '📧 Email',
        '⚡ 10s Reel Script',
        '📖 E-book',
        '📝 Misc'
    ];
    const styles = [
        'Aggressive', 'Story-driven', 'Direct', 'Educational', 'Empathetic',
        'Funny', 'Curiosity', 'Relatable', 'Personal'
    ];

    // 10+ Legends
    const legends = [
        'None',
        'David Ogilvy',
        'Joe Sugarman',
        'Frank Kern',
        'Eugene Schwartz',
        'Gary Halbert',
        'Claude Hopkins',
        'Robert Collier',
        'John Caples',
        'Dan Kennedy',
        'Gary Bencivenga',
        'Clayton Makepeace',
        'Victor Schwab'
    ];

    const handleGenerate = async () => {
        if (!apiKey) return;
        setLoading(true);
        try {
            const content = await generateCopy(apiKey, { docType, style, instructions, targetAudience, copywriter });
            onGenerated(content);
        } catch (e) {
            console.error(e);
            alert("Error generating copy. Check console/API Key.");
        } finally {
            setLoading(false);
        }
    };

    const handleImproveInstructions = async () => {
        if (!apiKey || !instructions.trim()) return;
        setPimpLoading(true);
        try {
            // Dynamic import to avoid circular dependency issues if any, or just consistent usage
            const { improveInstructions } = await import('../services/openai');
            const betterInstructions = await improveInstructions(apiKey, instructions, docType, style, targetAudience);
            setInstructions(betterInstructions);
        } catch (e) {
            console.error(e);
            alert("Error improving instructions.");
        } finally {
            setPimpLoading(false);
        }
    };

    return (
        <aside style={{
            width: '320px',
            borderRight: '1px solid var(--border-color)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            backgroundColor: 'var(--bg-secondary)',
            flexShrink: 0,
            overflowY: 'auto'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: '800' }}>ColorWriter</span>
                </h1>
                <button
                    onClick={onOpenSettings}
                    style={{ padding: '0.5rem', border: 'none', background: 'transparent' }}
                    title="Settings"
                >
                    <Settings size={20} color="var(--text-secondary)" />
                </button>
            </div>

            <div className="control-group">
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Document Type
                </label>
                <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    style={{ width: '100%' }}
                >
                    {docTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>

            <div className="control-group">
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Writing Style
                </label>
                <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    style={{ width: '100%' }}
                >
                    {styles.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            <div className="control-group">
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Write as (Legend)
                </label>
                <select
                    value={copywriter}
                    onChange={(e) => setCopywriter(e.target.value)}
                    style={{ width: '100%' }}
                >
                    {legends.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
            </div>

            <div className="control-group">
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Target Audience
                </label>
                <div style={{ position: 'relative' }}>
                    <User size={16} style={{ position: 'absolute', top: '10px', left: '10px', color: 'var(--text-tertiary)' }} />
                    <input
                        value={targetAudience}
                        onChange={(e) => setTargetAudience(e.target.value)}
                        placeholder="e.g. Busy Moms, CEOs..."
                        style={{ width: '100%', paddingLeft: '2.25rem' }}
                    />
                </div>
            </div>

            <div className="control-group" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Instructions
                    </label>
                    <button
                        onClick={handleImproveInstructions}
                        disabled={!apiKey || !instructions.trim() || pimpLoading}
                        style={{
                            fontSize: '0.7rem',
                            padding: '0.25rem 0.5rem',
                            height: 'auto',
                            background: '#e0f2fe',
                            color: '#0369a1',
                            border: '1px solid #bae6fd',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                        }}
                        title="Rewrite instructions for better AI results"
                    >
                        {pimpLoading ? <Loader2 className="animate-spin" size={10} /> : <Zap size={10} />}
                        Improve
                    </button>
                </div>
                <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Enter specific instructions, context, or product details here..."
                    style={{ width: '100%', flexGrow: 1, minHeight: '120px', resize: 'none', fontFamily: 'inherit' }}
                />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                    onClick={handleGenerate}
                    disabled={!apiKey || loading}
                    style={{
                        background: !apiKey || loading ? 'var(--bg-tertiary)' : '#111827',
                        color: !apiKey || loading ? 'var(--text-tertiary)' : '#ffffff',
                        fontSize: '1rem',
                        fontWeight: 600,
                        padding: '1rem',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '0.5rem',
                        border: 'none',
                        cursor: !apiKey || loading ? 'not-allowed' : 'pointer'
                    }}
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                    {loading ? 'Writing...' : 'Generate Copy'}
                </button>
                {/* Legend at the bottom */}
                <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
                    <ColorLegend activeItem={activeLegendItem} />
                </div>
            </div>
            {
                !apiKey && (
                    <p style={{ fontSize: '0.75rem', color: 'red', textAlign: 'center', marginTop: '0.5rem' }}>
                        Please add API Key in Settings to generate.
                    </p>
                )
            }

        </aside >
    );
};

export default Sidebar;


import React, { useState } from 'react';
import { Zap, Loader2, User } from 'lucide-react';
import { generateCopy } from '../services/openai';

const Sidebar = ({
    docType, setDocType,
    instructions, setInstructions,
    targetAudience, setTargetAudience,
    onGenerated,
    apiKey,
    offerType,
    setOfferType,
    situationsList,
    setSituationsList,
    painPoints,
    setPainPoints,
    hiddenFrustrations,
    setHiddenFrustrations,
    desiredOutcomes,
    setDesiredOutcomes,
    objections,
    setObjections,
    oldBelief,
    setOldBelief,
    newBelief,
    setNewBelief,
    desiredEmotion,
    setDesiredEmotion,
    primaryCta,
    setPrimaryCta,
    customMasterPrompt,
}) => {
    const [loading, setLoading] = useState(false);
    const [pimpLoading, setPimpLoading] = useState(false);

    const docTypes = [
        '📄 Sales Page',
        '📹 VSL',
        '📢 AD',
        '📘 Facebook Ad',
        '📧 Email',
        '⚡ 10s Reel Script'
    ];

    const offerTypes = ['High-ticket', 'Mid-ticket', 'Low-ticket'];

    const handleGenerate = async () => {
        if (!apiKey) return;
        setLoading(true);
        try {
            const content = await generateCopy(apiKey, {
                docType,
                instructions,
                targetAudience,
                offerType,
                situationsList,
                painPoints,
                hiddenFrustrations,
                desiredOutcomes,
                objections,
                oldBelief,
                newBelief,
                desiredEmotion,
                primaryCta,
                customMasterPrompt: customMasterPrompt || undefined
            });
            onGenerated(content);
        } catch (e) {
            console.error(e);
            const errorMessage = e.message || "Error generating copy. Check console/API Key.";
            alert(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleImproveInstructions = async () => {
        if (!apiKey || !instructions.trim() || !onImproveInstructions) return;
        setPimpLoading(true);
        try {
            const { improveInstructions } = await import('../services/openai');
            const betterInstructions = await improveInstructions(apiKey, instructions, docType, 'Direct', targetAudience);
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
            borderRight: '1px solid var(--border-default)',
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
                    Offer Type
                </label>
                <select
                    value={offerType}
                    onChange={(e) => setOfferType(e.target.value)}
                    style={{ width: '100%' }}
                >
                    {offerTypes.map(t => <option key={t} value={t}>{t}</option>)}
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

            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.5rem', marginBottom: '-0.5rem' }}>Audience & Offer</div>
            <div className="control-group">
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }} title="Specific situations to target (one per line)">
                    Specific Situations
                </label>
                <textarea
                    value={situationsList}
                    onChange={(e) => setSituationsList(e.target.value)}
                    placeholder={'• Situation 1\n• Situation 2\n• Situation 3\n• Situation 4\n• Situation 5'}
                    style={{ width: '100%', minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
                />
            </div>

            <div className="control-group">
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Pain Patterns</label>
                <textarea
                    value={painPoints}
                    onChange={(e) => setPainPoints(e.target.value)}
                    placeholder={'• Pain 1\n• Pain 2\n• Pain 3'}
                    style={{ width: '100%', minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
                />
            </div>

            <div className="control-group">
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Hidden Frustrations</label>
                <textarea
                    value={hiddenFrustrations}
                    onChange={(e) => setHiddenFrustrations(e.target.value)}
                    placeholder={'• Hidden issue 1\n• Hidden issue 2'}
                    style={{ width: '100%', minHeight: '50px', resize: 'vertical', fontFamily: 'inherit' }}
                />
            </div>

            <div className="control-group">
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Desired Outcomes</label>
                <textarea
                    value={desiredOutcomes}
                    onChange={(e) => setDesiredOutcomes(e.target.value)}
                    placeholder={'• Outcome 1\n• Outcome 2\n• Outcome 3'}
                    style={{ width: '100%', minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
                />
            </div>

            <div className="control-group">
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Common Objections</label>
                <textarea
                    value={objections}
                    onChange={(e) => setObjections(e.target.value)}
                    placeholder={'• Objection 1\n• Objection 2\n• Objection 3\n• Objection 4'}
                    style={{ width: '100%', minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
                />
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.5rem', marginBottom: '-0.5rem' }}>Intention</div>
            <div className="control-group">
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Old Belief</label>
                <input
                    value={oldBelief}
                    onChange={(e) => setOldBelief(e.target.value)}
                    placeholder="e.g. I'm broken or failing"
                    style={{ width: '100%' }}
                />
            </div>

            <div className="control-group">
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>New Belief</label>
                <input
                    value={newBelief}
                    onChange={(e) => setNewBelief(e.target.value)}
                    placeholder="e.g. It's a biological state I can change"
                    style={{ width: '100%' }}
                />
            </div>

            <div className="control-group">
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Desired Emotion After Reading</label>
                <input
                    value={desiredEmotion}
                    onChange={(e) => setDesiredEmotion(e.target.value)}
                    placeholder="e.g. Relief, Hope, Confidence"
                    style={{ width: '100%' }}
                />
            </div>

            <div className="control-group">
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Primary CTA</label>
                <input
                    value={primaryCta}
                    onChange={(e) => setPrimaryCta(e.target.value)}
                    placeholder="e.g. Get instant access, Book a call"
                    style={{ width: '100%' }}
                />
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

            <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                <button
                    onClick={handleGenerate}
                    disabled={!apiKey || loading}
                    style={{
                        width: '100%',
                        background: !apiKey || loading ? 'var(--bg-tertiary)' : 'var(--bg-hover)',
                        color: !apiKey || loading ? 'var(--text-tertiary)' : '#ffffff',
                        fontSize: '1rem',
                        fontWeight: 600,
                        padding: '1rem',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '0.5rem',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: !apiKey || loading ? 'not-allowed' : 'pointer'
                    }}
                >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                    {loading ? 'Writing...' : 'Generate Copy'}
                </button>
                {!apiKey && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '0.5rem' }}>
                        API key is shared across Saas apps. Configure it in another app (e.g. CopyWriter, PitchDeck) or refresh after setting.
                    </p>
                )}
            </div>

        </aside >
    );
};

export default Sidebar;

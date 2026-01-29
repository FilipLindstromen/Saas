import React, { useState } from 'react';
import { Wand2, Loader2, MessageCircle, Scale, BarChart3, RefreshCw, Palette, Plus, TrendingUp, Sparkles } from 'lucide-react';
import ColorLegend from './ColorLegend';

const RightPanel = ({
    apiKey,
    docType,
    targetAudience,
    onAnalyze,
    onFeedback,
    onBalance,
    onThreeKeyIngredients,
    onThreeRulesAnalysis,
    onInfuseBlockType,
    loading,
    feedbackLoading,
    balanceLoading,
    threeKeyIngredientsLoading,
    threeRulesLoading,
    conversionMetrics,
    onUpdateMetrics,
    metricsLoading,
    onImproveMetrics,
    isImproving,
    onHeaderSuggestions,
    activeLegendItem,
    selectedBlockType,
    onBlockTypeSelect,
    showColors,
    setShowColors
}) => {
    const [infuseBlockType, setInfuseBlockType] = useState('story');

    const blockTypes = [
        { value: 'hook', label: 'Hook', icon: '🎯' },
        { value: 'story', label: 'Story', icon: '📖' },
        { value: 'emotion', label: 'Emotion', icon: '❤️' },
        { value: 'logic', label: 'Logic', icon: '🧠' },
        { value: 'proof', label: 'Proof', icon: '✅' },
        { value: 'cta', label: 'CTA', icon: '🚀' },
        { value: 'ad', label: 'Ad/Creative', icon: '💡' },
        { value: 'misc', label: 'Misc', icon: '📝' }
    ];

    const ProgressBar = ({ label, value, color, feedback }) => (
        <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{value}%</span>
            </div>
            <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '4px',
                overflow: 'hidden',
                marginBottom: '0.25rem'
            }}>
                <div style={{
                    width: `${value}%`,
                    height: '100%',
                    backgroundColor: color,
                    borderRadius: '4px',
                    transition: 'width 1s ease-in-out'
                }} />
            </div>
            {feedback && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', lineHeight: '1.4', fontStyle: 'italic' }}>
                    {feedback}
                </div>
            )}
        </div>
    );

    return (
        <aside style={{
            width: '300px',
            background: 'var(--bg-primary)',
            borderLeft: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            transition: 'background 0.3s'
        }}>
            {/* Header */}
            <div style={{
                padding: '1.25rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--text-primary)'
            }}>
                <BarChart3 size={20} />
                <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Analysis & Actions</h2>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>

                {/* Color Legend */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                            Content Guide
                        </h3>
                        <button
                            onClick={() => setShowColors(!showColors)}
                            title={showColors ? "Hide background colors" : "Show background colors"}
                            style={{
                                border: '1px solid var(--border-color)',
                                background: showColors ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                padding: '0.4rem 0.75rem',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Palette size={14} />
                            {showColors ? 'Hide Colors' : 'Show Colors'}
                        </button>
                    </div>
                    <ColorLegend activeItem={activeLegendItem} selectedBlockType={selectedBlockType} onBlockTypeSelect={onBlockTypeSelect} />
                </div>

                {/* Main Actions Group */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Core Actions
                    </h3>

                    <button
                        onClick={onAnalyze}
                        disabled={!apiKey || loading}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            backgroundColor: 'var(--text-primary)',
                            color: 'var(--bg-primary)', // Inverted for emphasis
                            border: '1px solid var(--text-primary)',
                            opacity: !apiKey || loading ? 0.6 : 1,
                            cursor: !apiKey || loading ? 'not-allowed' : 'pointer',
                            padding: '0.6rem',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            transition: 'all 0.2s'
                        }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
                        {loading ? 'Analyzing...' : 'Analyze / Color'}
                    </button>

                    {/* Infuse Block Type Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <select
                            value={infuseBlockType}
                            onChange={(e) => setInfuseBlockType(e.target.value)}
                            disabled={!apiKey || loading}
                            style={{
                                padding: '0.5rem',
                                fontSize: '0.85rem',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                cursor: !apiKey || loading ? 'not-allowed' : 'pointer',
                                opacity: !apiKey || loading ? 0.6 : 1
                            }}
                        >
                            {blockTypes.map(block => (
                                <option key={block.value} value={block.value}>
                                    {block.icon} {block.label}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => onInfuseBlockType && onInfuseBlockType(infuseBlockType)}
                            disabled={!apiKey || loading || !onInfuseBlockType}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                opacity: !apiKey || loading ? 0.6 : 1,
                                cursor: !apiKey || loading ? 'not-allowed' : 'pointer',
                                padding: '0.6rem',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                borderRadius: '6px',
                                transition: 'all 0.2s'
                            }}
                            title={`Add more ${blockTypes.find(b => b.value === infuseBlockType)?.label} blocks to the copy`}
                        >
                            {loading ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                            {loading ? 'Infusing...' : `Infuse ${blockTypes.find(b => b.value === infuseBlockType)?.label}`}
                        </button>
                    </div>

                    <button
                        onClick={onFeedback}
                        disabled={!apiKey || !targetAudience || feedbackLoading}
                        style={{
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '0.6rem',
                            fontWeight: 500,
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            opacity: !apiKey || !targetAudience || feedbackLoading ? 0.6 : 1,
                            cursor: !apiKey || !targetAudience || feedbackLoading ? 'not-allowed' : 'pointer'
                        }}
                        title={!targetAudience ? "Enter Target Audience in Sidebar first" : "Get Audience Feedback"}
                    >
                        {feedbackLoading ? <Loader2 className="animate-spin" size={16} /> : <MessageCircle size={16} />}
                        {feedbackLoading ? 'Getting Feedback...' : 'Audience Feedback'}
                    </button>

                    <button
                        onClick={onBalance}
                        disabled={!apiKey || !targetAudience || balanceLoading}
                        style={{
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                            padding: '0.6rem', fontWeight: 500, borderRadius: '6px', fontSize: '0.85rem',
                            opacity: !apiKey || !targetAudience || balanceLoading ? 0.6 : 1,
                            cursor: !apiKey || !targetAudience || balanceLoading ? 'not-allowed' : 'pointer'
                        }}
                        title="Check Color Balance"
                    >
                        {balanceLoading ? <Loader2 className="animate-spin" size={16} /> : <Scale size={16} />}
                        {balanceLoading ? 'Analyzing...' : 'Check Balance'}
                    </button>

                    <button
                        onClick={onThreeKeyIngredients}
                        disabled={!apiKey || !targetAudience || threeKeyIngredientsLoading}
                        style={{
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                            padding: '0.6rem', fontWeight: 500, borderRadius: '6px', fontSize: '0.85rem',
                            opacity: !apiKey || !targetAudience || threeKeyIngredientsLoading ? 0.6 : 1,
                            cursor: !apiKey || !targetAudience || threeKeyIngredientsLoading ? 'not-allowed' : 'pointer'
                        }}
                        title="Analyze Four Key Ingredients"
                    >
                        {threeKeyIngredientsLoading ? <Loader2 className="animate-spin" size={16} /> : <TrendingUp size={16} />}
                        {threeKeyIngredientsLoading ? 'Analyzing...' : 'Analyze 4 Key Ingredients'}
                    </button>

                    <button
                        onClick={onThreeRulesAnalysis}
                        disabled={!apiKey || !targetAudience || threeRulesLoading}
                        style={{
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                            padding: '0.6rem', fontWeight: 500, borderRadius: '6px', fontSize: '0.85rem',
                            opacity: !apiKey || !targetAudience || threeRulesLoading ? 0.6 : 1,
                            cursor: !apiKey || !targetAudience || threeRulesLoading ? 'not-allowed' : 'pointer'
                        }}
                        title="Analyze Three Rules: Visualization, Falsifiability, Originality"
                    >
                        {threeRulesLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                        {threeRulesLoading ? 'Analyzing...' : 'Analyze 3 Rules'}
                    </button>
                </div>

                {/* Conversion Scorecard */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                            Conversion Scorecard
                        </h3>
                        <button
                            onClick={onUpdateMetrics}
                            disabled={metricsLoading || !apiKey}
                            style={{
                                border: 'none', background: 'transparent', padding: '4px', color: 'var(--text-tertiary)', cursor: 'pointer'
                            }}
                            title="Update Scores"
                        >
                            <RefreshCw size={14} className={metricsLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    <div style={{
                        background: 'var(--bg-secondary)',
                        padding: '1rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)'
                    }}>
                        {!conversionMetrics ? (
                            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                                Click the refresh icon to score your copy.
                            </div>
                        ) : (
                            <>
                                <ProgressBar
                                    label="Hook / Attention"
                                    value={conversionMetrics.metrics?.hook?.score || 0}
                                    color="var(--color-hook-text)"
                                    feedback={conversionMetrics.metrics?.hook?.feedback}
                                />
                                <ProgressBar
                                    label="Relatability"
                                    value={conversionMetrics.metrics?.relatable?.score || 0}
                                    color="var(--color-story-text)"
                                    feedback={conversionMetrics.metrics?.relatable?.feedback}
                                />
                                <ProgressBar
                                    label="Novelty / New"
                                    value={conversionMetrics.metrics?.novelty?.score || 0}
                                    color="var(--color-ad-text)"
                                    feedback={conversionMetrics.metrics?.novelty?.feedback}
                                />
                                <ProgressBar
                                    label="Credibility / Proof"
                                    value={conversionMetrics.metrics?.credibility?.score || 0}
                                    color="var(--color-proof-text)"
                                    feedback={conversionMetrics.metrics?.credibility?.feedback}
                                />
                                <ProgressBar
                                    label="Persuasion / Desire"
                                    value={conversionMetrics.metrics?.persuasion?.score || 0}
                                    color="var(--color-cta-text)"
                                    feedback={conversionMetrics.metrics?.persuasion?.feedback}
                                />
                                <ProgressBar
                                    label="Header Quality"
                                    value={conversionMetrics.metrics?.headers?.score || 0}
                                    color="var(--text-primary)"
                                    feedback={conversionMetrics.metrics?.headers?.feedback}
                                />
                            </>
                        )}
                    </div>

                    {/* Improve Button */}
                    {conversionMetrics && (
                        <>
                            <button
                                onClick={onImproveMetrics}
                                disabled={!apiKey || metricsLoading || isImproving}
                                style={{
                                    marginTop: '0.75rem',
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    backgroundColor: 'var(--color-cta-text)',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '0.75rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    borderRadius: '6px',
                                    cursor: !apiKey || metricsLoading || isImproving ? 'not-allowed' : 'pointer',
                                    opacity: !apiKey || metricsLoading || isImproving ? 0.6 : 1,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {(metricsLoading || isImproving) ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />}
                                {(metricsLoading || isImproving) ? 'Improving...' : 'Improve Copy'}
                            </button>

                            <button
                                onClick={onHeaderSuggestions}
                                disabled={!apiKey || metricsLoading}
                                style={{
                                    marginTop: '0.5rem',
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    backgroundColor: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border-color)',
                                    padding: '0.75rem',
                                    fontSize: '0.85rem',
                                    fontWeight: 500,
                                    borderRadius: '6px',
                                    cursor: !apiKey || metricsLoading ? 'not-allowed' : 'pointer',
                                    opacity: !apiKey || metricsLoading ? 0.6 : 1,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {metricsLoading ? <Loader2 className="animate-spin" size={16} /> : <MessageCircle size={16} />}
                                {metricsLoading ? 'Generating...' : 'Header Suggestions'}
                            </button>
                        </>
                    )}
                </div>

                {/* Perfect Fit Audience */}
                {conversionMetrics?.perfect_audience_analysis && (
                    <div>
                        <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                            Who Is This Actually For?
                        </h3>
                        <div style={{
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)',
                            lineHeight: '1.6',
                            background: 'var(--bg-secondary)',
                            padding: '1rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)'
                        }}>
                            {conversionMetrics.perfect_audience_analysis}
                        </div>
                    </div>
                )}

            </div>
        </aside>
    );
};

export default RightPanel;

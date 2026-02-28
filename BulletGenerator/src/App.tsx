import { useState, useEffect } from 'react';
import AppTopBar from '@shared/AppTopBar/AppTopBar';
import ThemeToggle from '@shared/ThemeToggle';
import SettingsModal from '@shared/SettingsModal/SettingsModal';
import { List, Settings, Sparkles } from 'lucide-react';
import { getApiKey } from '@shared/apiKeys';
import { getTheme, setTheme, initThemeSync } from '@shared/theme';
import { generateBulletsWithOpenAI } from './api';
import './App.css';

export default function App() {
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => getTheme() as 'light' | 'dark');
  const [showSettings, setShowSettings] = useState(false);

  // Form state
  const [documentType, setDocumentType] = useState('Sales Page');
  const [offerType, setOfferType] = useState('Mid-ticket');
  const [targetAudience, setTargetAudience] = useState('');
  const [offer, setOffer] = useState('');
  const [situations, setSituations] = useState('Situation 1\nSituation 2\nSituation 3');
  const [painPatterns, setPainPatterns] = useState('Pain 1\nPain 2\nPain 3');
  const [hiddenFrustrations, setHiddenFrustrations] = useState('Hidden issue 1\nHidden issue 2');
  const [desiredOutcomes, setDesiredOutcomes] = useState('Outcome 1\nOutcome 2\nOutcome 3');
  const [objections, setObjections] = useState('Objection 1\nObjection 2\nObjection 3');
  const [oldBelief, setOldBelief] = useState('');
  const [newBelief, setNewBelief] = useState('');
  const [desiredEmotion, setDesiredEmotion] = useState('');
  const [primaryCta, setPrimaryCta] = useState('');

  const [editorContent, setEditorContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = initThemeSync();
    const handler = () => setThemeState(getTheme() as 'light' | 'dark');
    window.addEventListener('saas-theme-change', handler);
    return () => {
      unsub?.();
      window.removeEventListener('saas-theme-change', handler);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleGenerate = async () => {
    const apiKey = getApiKey('openai');
    if (!apiKey?.trim()) {
      setError('Please add your OpenAI API key in the SaaS Apps Settings.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const bullets = await generateBulletsWithOpenAI(apiKey, {
        offer,
        targetAudience,
        documentType,
        offerType,
        situations,
        painPatterns,
        hiddenFrustrations,
        desiredOutcomes,
        objections,
        oldBelief,
        newBelief,
        desiredEmotion,
        primaryCta,
      });
      setEditorContent((prev) => (prev ? `${prev}\n\n${bullets}` : bullets));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <AppTopBar
        logo={
          <span className="bullet-gen-logo">
            <List size={20} strokeWidth={2} />
            Bullet Generator
          </span>
        }
        showProject={false}
        showTabs={false}
        actions={
          <>
            <button
              type="button"
              className="shared-toolbar-btn"
              onClick={() => setShowSettings(true)}
              title="Settings"
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
            <ThemeToggle
              theme={theme}
              onToggle={(t: 'light' | 'dark') => {
                setTheme(t);
                setThemeState(t);
              }}
              className="shared-toolbar-btn"
            />
          </>
        }
      />

      <div className="workArea">
        <div className="leftPanel">
          <div className="panelHeader">
            <Sparkles size={18} />
            Offer & Audience
          </div>
          <div className="panelContent">
            {error && <div className="errorMsg">{error}</div>}

            <div className="formGroup">
              <label className="label">Document Type</label>
              <select
                className="input"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                <option value="Sales Page">Sales Page</option>
                <option value="VSL">VSL</option>
                <option value="Email">Email</option>
                <option value="Ad">Ad</option>
                <option value="Landing Page">Landing Page</option>
              </select>
            </div>

            <div className="formGroup">
              <label className="label">Offer Type</label>
              <select
                className="input"
                value={offerType}
                onChange={(e) => setOfferType(e.target.value)}
              >
                <option value="Low-ticket">Low-ticket</option>
                <option value="Mid-ticket">Mid-ticket</option>
                <option value="High-ticket">High-ticket</option>
              </select>
            </div>

            <div className="formGroup">
              <label className="label">Target Audience</label>
              <input
                className="input"
                placeholder="e.g. High achievers"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>

            <div className="formGroup">
              <label className="label">Offer / Product</label>
              <input
                className="input"
                placeholder="Brief description of your offer"
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
              />
            </div>

            <div className="sectionLabel">AUDIENCE & OFFER</div>

            <div className="formGroup">
              <label className="label">Specific Situations</label>
              <textarea
                className="textarea"
                rows={3}
                placeholder="One per line"
                value={situations}
                onChange={(e) => setSituations(e.target.value)}
              />
            </div>

            <div className="formGroup">
              <label className="label">Pain Patterns</label>
              <textarea
                className="textarea"
                rows={3}
                placeholder="One per line"
                value={painPatterns}
                onChange={(e) => setPainPatterns(e.target.value)}
              />
            </div>

            <div className="formGroup">
              <label className="label">Hidden Frustrations</label>
              <textarea
                className="textarea"
                rows={2}
                placeholder="One per line"
                value={hiddenFrustrations}
                onChange={(e) => setHiddenFrustrations(e.target.value)}
              />
            </div>

            <div className="formGroup">
              <label className="label">Desired Outcomes</label>
              <textarea
                className="textarea"
                rows={3}
                placeholder="One per line"
                value={desiredOutcomes}
                onChange={(e) => setDesiredOutcomes(e.target.value)}
              />
            </div>

            <div className="formGroup">
              <label className="label">Common Objections</label>
              <textarea
                className="textarea"
                rows={3}
                placeholder="One per line"
                value={objections}
                onChange={(e) => setObjections(e.target.value)}
              />
            </div>

            <div className="sectionLabel">INTENTION</div>

            <div className="formGroup">
              <label className="label">Old Belief</label>
              <input
                className="input"
                placeholder="e.g. I'm broken or failing"
                value={oldBelief}
                onChange={(e) => setOldBelief(e.target.value)}
              />
            </div>

            <div className="formGroup">
              <label className="label">New Belief</label>
              <input
                className="input"
                placeholder="e.g. It's a biological state I can change"
                value={newBelief}
                onChange={(e) => setNewBelief(e.target.value)}
              />
            </div>

            <div className="formGroup">
              <label className="label">Desired Emotion After Reading</label>
              <input
                className="input"
                placeholder="e.g. Relief, Hope, Confidence"
                value={desiredEmotion}
                onChange={(e) => setDesiredEmotion(e.target.value)}
              />
            </div>

            <div className="formGroup">
              <label className="label">Primary CTA</label>
              <input
                className="input"
                placeholder="e.g. Join the program"
                value={primaryCta}
                onChange={(e) => setPrimaryCta(e.target.value)}
              />
            </div>

            <button
              className="generateBtn"
              onClick={handleGenerate}
              disabled={loading}
            >
              <Sparkles size={18} />
              {loading ? 'Generating...' : 'Generate Bullets'}
            </button>
          </div>
        </div>

        <div className="editorPanel">
          <div className="panelHeader">
            <List size={18} />
            Bullets & Content
          </div>
          <div className="editorContent">
            <textarea
              className="editorTextarea"
              placeholder="Generated bullets will appear here. You can edit, add more content, or paste your own text..."
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
            />
          </div>
        </div>
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}

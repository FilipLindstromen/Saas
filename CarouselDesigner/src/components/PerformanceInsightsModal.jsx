import { useCallback, useEffect, useState } from 'react'
import { getApiKey } from '@shared/apiKeys'
import {
  fetchRecentAds,
  fetchAdInsights,
  analyzeInsightsForSuggestions,
  normalizeAdAccountId,
  getAdsManagerUrl,
} from '@shared/metaAdsApi'
import './PerformanceInsightsModal.css'

export default function PerformanceInsightsModal({
  isOpen,
  onClose,
  slides = [],
  lastExportedAdId,
}) {
  const [ads, setAds] = useState([])
  const [selectedAdId, setSelectedAdId] = useState(lastExportedAdId || '')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [insights, setInsights] = useState(null)
  const [analysis, setAnalysis] = useState(null)

  const accessToken = getApiKey('metaAccessToken')
  const adAccountId = getApiKey('metaAdAccountId')
  const hasCredentials = !!(accessToken?.trim() && adAccountId?.trim())

  const loadAds = useCallback(async () => {
    if (!hasCredentials) return
    setLoading(true)
    setLoadError('')
    try {
      const list = await fetchRecentAds(normalizeAdAccountId(adAccountId), accessToken.trim())
      setAds(list.filter((a) => a.effective_status !== 'DELETED').slice(0, 20))
      if (!selectedAdId && list[0]?.id) setSelectedAdId(list[0].id)
      if (lastExportedAdId && list.some((a) => a.id === lastExportedAdId)) {
        setSelectedAdId(lastExportedAdId)
      }
    } catch (err) {
      setLoadError(err?.message || 'Could not load ads')
    } finally {
      setLoading(false)
    }
  }, [hasCredentials, adAccountId, accessToken, selectedAdId, lastExportedAdId])

  const loadInsights = useCallback(async (adId) => {
    if (!adId || !hasCredentials) return
    setLoading(true)
    setLoadError('')
    try {
      const data = await fetchAdInsights(adId, accessToken.trim())
      setInsights(data)
      setAnalysis(analyzeInsightsForSuggestions(data, slides))
    } catch (err) {
      setLoadError(err?.message || 'Could not load insights')
      setInsights(null)
      setAnalysis(analyzeInsightsForSuggestions({ data: [] }, slides))
    } finally {
      setLoading(false)
    }
  }, [hasCredentials, accessToken, slides])

  useEffect(() => {
    if (isOpen && hasCredentials) loadAds()
  }, [isOpen, hasCredentials, loadAds])

  useEffect(() => {
    if (isOpen && selectedAdId) loadInsights(selectedAdId)
  }, [isOpen, selectedAdId, loadInsights])

  if (!isOpen) return null

  const metrics = analysis?.metrics || {}

  return (
    <div className="performance-modal-backdrop" onClick={onClose} role="presentation">
      <div className="performance-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="perf-title">
        <header className="performance-modal-header">
          <h2 id="perf-title">Performance insights</h2>
          <button type="button" className="performance-modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        {!hasCredentials ? (
          <p className="performance-hint">Connect Meta credentials on the SaaS Apps API keys screen.</p>
        ) : (
          <>
            <div className="performance-field">
              <label htmlFor="perf-ad-select">Select ad</label>
              <select
                id="perf-ad-select"
                value={selectedAdId}
                onChange={(e) => setSelectedAdId(e.target.value)}
                disabled={loading}
              >
                <option value="">Choose an ad…</option>
                {ads.map((ad) => (
                  <option key={ad.id} value={ad.id}>{ad.name || ad.id}</option>
                ))}
              </select>
            </div>

            {loadError && <p className="performance-error">{loadError}</p>}

            {loading && <p className="performance-loading">Loading insights…</p>}

            {!loading && analysis && (
              <>
                <div className="performance-metrics">
                  <div className="performance-metric">
                    <span className="performance-metric-value">{metrics.impressions || '—'}</span>
                    <span className="performance-metric-label">Impressions</span>
                  </div>
                  <div className="performance-metric">
                    <span className="performance-metric-value">{metrics.clicks || '—'}</span>
                    <span className="performance-metric-label">Clicks</span>
                  </div>
                  <div className="performance-metric">
                    <span className="performance-metric-value">{metrics.ctr ? `${parseFloat(metrics.ctr).toFixed(2)}%` : '—'}</span>
                    <span className="performance-metric-label">CTR</span>
                  </div>
                  <div className="performance-metric">
                    <span className="performance-metric-value">{metrics.spend ? `$${parseFloat(metrics.spend).toFixed(2)}` : '—'}</span>
                    <span className="performance-metric-label">Spend</span>
                  </div>
                </div>

                <h3>Suggestions</h3>
                <ul className="performance-suggestions">
                  {(analysis.suggestions || []).map((s, i) => (
                    <li key={i} className={`performance-suggestion severity-${s.severity}`}>
                      {s.message}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {selectedAdId && (
              <a
                className="performance-link"
                href={getAdsManagerUrl(adAccountId, selectedAdId)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Ads Manager →
              </a>
            )}
          </>
        )}
      </div>
    </div>
  )
}

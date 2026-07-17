import { useCallback, useEffect, useState } from 'react'
import { getApiKey } from '@shared/apiKeys'
import {
  fetchRecentAds,
  fetchAdInsights,
  analyzeInsightsForSuggestions,
  normalizeAdAccountId,
  getAdsManagerUrl,
} from '@shared/metaAdsApi'
import './PerformanceInsightsPanel.css'

export default function PerformanceInsightsPanel({ slides = [], lastExportedAdId }) {
  const [ads, setAds] = useState([])
  const [selectedAdId, setSelectedAdId] = useState(lastExportedAdId || '')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [analysis, setAnalysis] = useState(null)

  const accessToken = getApiKey('metaAccessToken')
  const adAccountId = getApiKey('metaAdAccountId')
  const hasCredentials = !!(accessToken?.trim() && adAccountId?.trim())

  const loadAds = useCallback(async () => {
    if (!hasCredentials) return
    setLoading(true)
    try {
      const list = await fetchRecentAds(normalizeAdAccountId(adAccountId), accessToken.trim())
      setAds(list.slice(0, 15))
      if (lastExportedAdId && list.some((a) => a.id === lastExportedAdId)) {
        setSelectedAdId(lastExportedAdId)
      } else if (!selectedAdId && list[0]?.id) {
        setSelectedAdId(list[0].id)
      }
    } catch (err) {
      setLoadError(err?.message || 'Could not load ads')
    } finally {
      setLoading(false)
    }
  }, [hasCredentials, adAccountId, accessToken, lastExportedAdId, selectedAdId])

  const loadInsights = useCallback(async (adId) => {
    if (!adId || !hasCredentials) {
      setAnalysis(analyzeInsightsForSuggestions({ data: [] }, slides))
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const data = await fetchAdInsights(adId, accessToken.trim())
      setAnalysis(analyzeInsightsForSuggestions(data, slides))
    } catch (err) {
      setLoadError(err?.message || 'Could not load insights')
      setAnalysis(analyzeInsightsForSuggestions({ data: [] }, slides))
    } finally {
      setLoading(false)
    }
  }, [hasCredentials, accessToken, slides])

  useEffect(() => {
    if (hasCredentials) loadAds()
  }, [hasCredentials, loadAds])

  useEffect(() => {
    if (selectedAdId) loadInsights(selectedAdId)
    else setAnalysis(analyzeInsightsForSuggestions({ data: [] }, slides))
  }, [selectedAdId, loadInsights, slides])

  if (!hasCredentials) {
    return (
      <p className="performance-panel-hint">
        Connect Meta on the SaaS Apps API keys screen to see ad performance and improvement suggestions.
      </p>
    )
  }

  const metrics = analysis?.metrics || {}

  return (
    <div className="performance-insights-panel">
      <p className="performance-panel-hint">Pull metrics from Meta and get copy/structure suggestions for your carousel.</p>

      <label className="performance-panel-label" htmlFor="perf-panel-ad">Ad</label>
      <select
        id="perf-panel-ad"
        className="performance-panel-select"
        value={selectedAdId}
        onChange={(e) => setSelectedAdId(e.target.value)}
        disabled={loading}
      >
        <option value="">Select ad…</option>
        {ads.map((ad) => (
          <option key={ad.id} value={ad.id}>{ad.name || ad.id}</option>
        ))}
      </select>

      <button type="button" className="performance-panel-refresh" onClick={loadAds} disabled={loading}>
        Refresh ads
      </button>

      {loadError && <p className="performance-panel-error">{loadError}</p>}
      {loading && <p className="performance-panel-hint">Loading…</p>}

      {analysis && !loading && (
        <>
          <div className="performance-panel-metrics">
            <span><strong>{metrics.impressions || '—'}</strong> impr.</span>
            <span><strong>{metrics.ctr ? `${parseFloat(metrics.ctr).toFixed(2)}%` : '—'}</strong> CTR</span>
          </div>
          <ul className="performance-panel-suggestions">
            {(analysis.suggestions || []).map((s, i) => (
              <li key={i} className={`severity-${s.severity}`}>{s.message}</li>
            ))}
          </ul>
        </>
      )}

      {selectedAdId && (
        <a
          className="performance-panel-link"
          href={getAdsManagerUrl(adAccountId, selectedAdId)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open in Ads Manager
        </a>
      )}
    </div>
  )
}

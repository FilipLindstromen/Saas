import { useCallback, useEffect, useState } from 'react'
import { getApiKey } from '@shared/apiKeys'
import {
  fetchAdSets,
  fetchCampaigns,
  fetchPromotePages,
  normalizeAdAccountId,
} from '@shared/metaAdsApi'
import './MetaExportModal.css'

const PREFS_KEY = 'nagMetaExportPrefs'

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

export default function MetaExportModal({
  isOpen,
  onClose,
  onSubmit,
  busy,
  error,
  defaultAdName = '',
  defaultDestinationUrl = '',
}) {
  const [campaignId, setCampaignId] = useState('')
  const [adSetId, setAdSetId] = useState('')
  const [pageId, setPageId] = useState('')
  const [destinationUrl, setDestinationUrl] = useState(defaultDestinationUrl)
  const [adName, setAdName] = useState(defaultAdName)
  const [campaigns, setCampaigns] = useState([])
  const [adSets, setAdSets] = useState([])
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const accessToken = getApiKey('metaAccessToken')
  const adAccountId = getApiKey('metaAdAccountId')
  const savedPageId = getApiKey('metaPageId')
  const hasCredentials = !!(accessToken?.trim() && adAccountId?.trim())

  const loadMetaData = useCallback(async () => {
    if (!hasCredentials) return
    setLoading(true)
    setLoadError('')
    try {
      const token = accessToken.trim()
      const actId = normalizeAdAccountId(adAccountId)
      const [campaignList, pageList] = await Promise.all([
        fetchCampaigns(actId, token),
        fetchPromotePages(actId, token),
      ])
      setCampaigns(campaignList)
      setPages(pageList)

      const prefs = loadPrefs()
      const preferredCampaign = prefs.campaignId && campaignList.some((c) => c.id === prefs.campaignId)
        ? prefs.campaignId
        : campaignList[0]?.id || ''
      setCampaignId(preferredCampaign)

      const preferredPage = savedPageId?.trim()
        || (prefs.pageId && pageList.some((p) => p.id === prefs.pageId) ? prefs.pageId : '')
        || pageList[0]?.id
        || ''
      setPageId(preferredPage)

      if (prefs.destinationUrl) setDestinationUrl(prefs.destinationUrl)
      if (prefs.adName) setAdName(prefs.adName)
    } catch (err) {
      setLoadError(err?.message || 'Failed to load Meta campaigns')
      setCampaigns([])
      setAdSets([])
      setPages([])
    } finally {
      setLoading(false)
    }
  }, [accessToken, adAccountId, hasCredentials, savedPageId])

  useEffect(() => {
    if (!isOpen) return
    setAdName(defaultAdName || loadPrefs().adName || '')
    if (defaultDestinationUrl) setDestinationUrl(defaultDestinationUrl)
    loadMetaData()
  }, [isOpen, defaultAdName, defaultDestinationUrl, loadMetaData])

  useEffect(() => {
    if (!isOpen || !campaignId || !hasCredentials) {
      setAdSets([])
      return undefined
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError('')
      try {
        const sets = await fetchAdSets(normalizeAdAccountId(adAccountId), campaignId, accessToken.trim())
        if (cancelled) return
        setAdSets(sets)
        const prefs = loadPrefs()
        const preferred = prefs.adSetId && sets.some((s) => s.id === prefs.adSetId) && prefs.campaignId === campaignId
          ? prefs.adSetId
          : sets[0]?.id || ''
        setAdSetId(preferred)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err?.message || 'Failed to load ad sets')
          setAdSets([])
          setAdSetId('')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, campaignId, adAccountId, accessToken, hasCredentials])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!campaignId || !adSetId || !pageId || !destinationUrl.trim()) return
    savePrefs({ campaignId, adSetId, pageId, destinationUrl: destinationUrl.trim(), adName: adName.trim() })
    onSubmit({
      campaignId,
      adSetId,
      pageId,
      destinationUrl: destinationUrl.trim(),
      adName: adName.trim() || defaultAdName || 'Native ad',
    })
  }

  if (!isOpen) return null

  return (
    <div className="nag-meta-backdrop" onClick={onClose}>
      <div className="nag-meta-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="nag-meta-title">
        <div className="nag-meta-header">
          <h2 id="nag-meta-title">Export as Meta ad</h2>
          <button type="button" className="nag-meta-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form className="nag-meta-body" onSubmit={handleSubmit}>
          {!hasCredentials ? (
            <p className="nag-meta-error">
              Add your Meta Access Token, Ad Account ID, and Facebook Page ID in API keys (SaaS Apps settings).
              The token needs <code>ads_management</code> permission.
            </p>
          ) : (
            <>
              <p className="nag-meta-hint">
                Creates a <strong>paused</strong> ad in the selected ad set — ready to preview and publish in Meta Ads Manager.
              </p>

              {loadError && <p className="nag-meta-error">{loadError}</p>}
              {error && <p className="nag-meta-error">{error}</p>}

              <div className="nag-field-group">
                <label className="nag-label" htmlFor="nag-meta-campaign">Campaign</label>
                <select
                  id="nag-meta-campaign"
                  className="nag-select"
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  disabled={loading || busy || !campaigns.length}
                >
                  {!campaigns.length && <option value="">No campaigns found</option>}
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.effective_status ? `(${c.effective_status})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="nag-field-group">
                <label className="nag-label" htmlFor="nag-meta-adset">Ad set</label>
                <select
                  id="nag-meta-adset"
                  className="nag-select"
                  value={adSetId}
                  onChange={(e) => setAdSetId(e.target.value)}
                  disabled={loading || busy || !adSets.length}
                >
                  {!adSets.length && <option value="">Select a campaign first</option>}
                  {adSets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.effective_status ? `(${s.effective_status})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="nag-field-group">
                <label className="nag-label" htmlFor="nag-meta-page">Facebook page</label>
                <select
                  id="nag-meta-page"
                  className="nag-select"
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  disabled={loading || busy || !pages.length}
                >
                  {!pages.length && <option value={savedPageId || ''}>{savedPageId || 'No pages found'}</option>}
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>{p.name || p.id}</option>
                  ))}
                </select>
              </div>

              <div className="nag-field-group">
                <label className="nag-label" htmlFor="nag-meta-url">Destination URL</label>
                <input
                  id="nag-meta-url"
                  type="url"
                  className="nag-input"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://yoursite.com/landing"
                  required
                  disabled={busy}
                />
              </div>

              <div className="nag-field-group">
                <label className="nag-label" htmlFor="nag-meta-ad-name">Ad name</label>
                <input
                  id="nag-meta-ad-name"
                  type="text"
                  className="nag-input"
                  value={adName}
                  onChange={(e) => setAdName(e.target.value)}
                  placeholder="Native ad draft"
                  disabled={busy}
                />
              </div>
            </>
          )}

          <div className="nag-meta-footer">
            <button type="button" className="nag-btn" onClick={onClose} disabled={busy}>Cancel</button>
            <button
              type="submit"
              className="nag-btn nag-btn-accent"
              disabled={busy || loading || !hasCredentials || !campaignId || !adSetId || !pageId || !destinationUrl.trim()}
            >
              {busy ? 'Creating…' : 'Create paused ad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { getApiKey } from '@shared/apiKeys'
import {
  fetchAdSets,
  fetchCampaigns,
  fetchPromotePages,
  normalizeAdAccountId,
} from '@shared/metaAdsApi'
import './MetaCarouselExportModal.css'

const PREFS_KEY = 'carouselDesignerMetaExportPrefs'

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

export default function MetaCarouselExportModal({
  isOpen,
  onClose,
  onSubmit,
  busy,
  error,
  slideCount = 0,
  defaultAdName = '',
  defaultPrimaryText = '',
  defaultDestinationUrl = '',
}) {
  const [campaignId, setCampaignId] = useState('')
  const [adSetId, setAdSetId] = useState('')
  const [pageId, setPageId] = useState('')
  const [destinationUrl, setDestinationUrl] = useState(defaultDestinationUrl)
  const [primaryText, setPrimaryText] = useState(defaultPrimaryText)
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
      if (prefs.primaryText) setPrimaryText(prefs.primaryText)
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
    setPrimaryText(defaultPrimaryText || loadPrefs().primaryText || '')
    if (defaultDestinationUrl) setDestinationUrl(defaultDestinationUrl)
    loadMetaData()
  }, [isOpen, defaultAdName, defaultPrimaryText, defaultDestinationUrl, loadMetaData])

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
    savePrefs({
      campaignId,
      adSetId,
      pageId,
      destinationUrl: destinationUrl.trim(),
      primaryText: primaryText.trim(),
      adName: adName.trim(),
    })
    onSubmit({
      campaignId,
      adSetId,
      pageId,
      destinationUrl: destinationUrl.trim(),
      primaryText: primaryText.trim(),
      adName: adName.trim() || defaultAdName || 'Carousel ad',
    })
  }

  if (!isOpen) return null

  return (
    <div className="cd-meta-backdrop" onClick={onClose}>
      <div className="cd-meta-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="cd-meta-title">
        <div className="cd-meta-header">
          <h2 id="cd-meta-title">Export carousel to Meta</h2>
          <button type="button" className="cd-meta-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form className="cd-meta-body" onSubmit={handleSubmit}>
          {!hasCredentials ? (
            <p className="cd-meta-error">
              Add your Meta Access Token, Ad Account ID, and Facebook Page ID in API keys on the SaaS Apps home screen.
              The token needs <code>ads_management</code> permission.
            </p>
          ) : (
            <>
              <p className="cd-meta-hint">
                Uploads {slideCount} carousel image{slideCount === 1 ? '' : 's'} (1080×1440) and creates a <strong>paused</strong> carousel ad in your ad set.
              </p>

              {loadError && <p className="cd-meta-error">{loadError}</p>}
              {error && <p className="cd-meta-error">{error}</p>}

              <div className="cd-meta-field">
                <label htmlFor="cd-meta-campaign">Campaign</label>
                <select id="cd-meta-campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} disabled={loading || busy || !campaigns.length}>
                  {!campaigns.length && <option value="">No campaigns found</option>}
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="cd-meta-field">
                <label htmlFor="cd-meta-adset">Ad set</label>
                <select id="cd-meta-adset" value={adSetId} onChange={(e) => setAdSetId(e.target.value)} disabled={loading || busy || !adSets.length}>
                  {!adSets.length && <option value="">Select a campaign first</option>}
                  {adSets.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="cd-meta-field">
                <label htmlFor="cd-meta-page">Facebook page</label>
                <select id="cd-meta-page" value={pageId} onChange={(e) => setPageId(e.target.value)} disabled={loading || busy || !pages.length}>
                  {!pages.length && <option value={savedPageId || ''}>{savedPageId || 'No pages found'}</option>}
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>{p.name || p.id}</option>
                  ))}
                </select>
              </div>

              <div className="cd-meta-field">
                <label htmlFor="cd-meta-url">Destination URL</label>
                <input id="cd-meta-url" type="url" value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://yoursite.com" required disabled={busy} />
              </div>

              <div className="cd-meta-field">
                <label htmlFor="cd-meta-primary">Primary text</label>
                <textarea id="cd-meta-primary" rows={3} value={primaryText} onChange={(e) => setPrimaryText(e.target.value)} placeholder="Caption shown with the carousel ad" disabled={busy} />
              </div>

              <div className="cd-meta-field">
                <label htmlFor="cd-meta-ad-name">Ad name</label>
                <input id="cd-meta-ad-name" type="text" value={adName} onChange={(e) => setAdName(e.target.value)} placeholder="Carousel ad draft" disabled={busy} />
              </div>
            </>
          )}

          <div className="cd-meta-footer">
            <button type="button" className="cd-meta-btn" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="cd-meta-btn cd-meta-btn-accent" disabled={busy || loading || !hasCredentials || !campaignId || !adSetId || !pageId || !destinationUrl.trim() || slideCount < 1}>
              {busy ? 'Uploading…' : 'Create paused carousel ad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

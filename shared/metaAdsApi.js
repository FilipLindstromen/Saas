const GRAPH_VERSION = 'v21.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

export function normalizeAdAccountId(id) {
  const raw = String(id || '').trim().replace(/^act_/i, '')
  return raw ? `act_${raw}` : ''
}

export function getAdsManagerUrl(adAccountId, adId) {
  const numeric = String(adAccountId || '').replace(/^act_/i, '')
  const base = `https://www.facebook.com/adsmanager/manage/ads?act=${numeric}`
  return adId ? `${base}&selected_ad_ids=${adId}` : base
}

function parseGraphError(data, status) {
  const msg = data?.error?.message || data?.error?.error_user_msg
  if (msg) return msg
  return `Meta API error (${status})`
}

export async function graphGet(path, accessToken, params = {}) {
  const url = new URL(`${GRAPH_BASE}/${path.replace(/^\//, '')}`)
  url.searchParams.set('access_token', accessToken)
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') url.searchParams.set(key, String(value))
  })
  const res = await fetch(url.toString())
  const data = await res.json()
  if (!res.ok || data.error) {
    throw new Error(parseGraphError(data, res.status))
  }
  return data
}

async function graphGetAll(path, accessToken, params = {}) {
  const items = []
  let nextPath = path
  let nextParams = { ...params, limit: params.limit || '100' }
  let useFullUrl = false

  for (let guard = 0; guard < 20; guard += 1) {
    let data
    if (useFullUrl) {
      const res = await fetch(nextPath)
      data = await res.json()
      if (!res.ok || data.error) throw new Error(parseGraphError(data, res.status))
    } else {
      data = await graphGet(nextPath, accessToken, nextParams)
    }

    if (Array.isArray(data.data)) items.push(...data.data)
    const next = data.paging?.next
    if (!next) break
    nextPath = next
    useFullUrl = true
    nextParams = {}
  }

  return items
}

export async function fetchAdAccounts(accessToken) {
  const accounts = await graphGetAll('me/adaccounts', accessToken, {
    fields: 'id,name,account_id,account_status',
    limit: '100',
  })
  return accounts.filter((a) => a.account_status === 1 || a.account_status === 'ACTIVE' || a.account_status == null)
}

export async function fetchCampaigns(adAccountId, accessToken) {
  const actId = normalizeAdAccountId(adAccountId)
  return graphGetAll(`${actId}/campaigns`, accessToken, {
    fields: 'id,name,status,effective_status,objective',
    limit: '100',
  })
}

export async function fetchAdSets(adAccountId, campaignId, accessToken) {
  const actId = normalizeAdAccountId(adAccountId)
  const filtering = JSON.stringify([{ field: 'campaign.id', operator: 'EQUAL', value: campaignId }])
  return graphGetAll(`${actId}/adsets`, accessToken, {
    fields: 'id,name,status,effective_status,campaign_id',
    filtering,
    limit: '100',
  })
}

export async function fetchPromotePages(adAccountId, accessToken) {
  const actId = normalizeAdAccountId(adAccountId)
  try {
    const data = await graphGet(`${actId}/promote_pages`, accessToken, {
      fields: 'id,name',
      limit: '50',
    })
    return data.data || []
  } catch {
    const data = await graphGet('me/accounts', accessToken, {
      fields: 'id,name',
      limit: '50',
    })
    return data.data || []
  }
}

export async function uploadAdImage(adAccountId, accessToken, imageBlob, filename = 'native-ad.png') {
  const actId = normalizeAdAccountId(adAccountId)
  const form = new FormData()
  form.append('access_token', accessToken)
  form.append('filename', imageBlob, filename)

  const res = await fetch(`${GRAPH_BASE}/${actId}/adimages`, {
    method: 'POST',
    body: form,
  })
  const data = await res.json()
  if (!res.ok || data.error) {
    throw new Error(parseGraphError(data, res.status))
  }

  const images = data.images || {}
  const entry = images[filename] || Object.values(images)[0]
  const hash = entry?.hash
  if (!hash) throw new Error('Meta did not return an image hash')
  return hash
}

export async function createCarouselAdCreative({
  adAccountId,
  accessToken,
  pageId,
  destinationUrl,
  primaryText,
  childAttachments,
  creativeName,
}) {
  const actId = normalizeAdAccountId(adAccountId)
  const url = new URL(`${GRAPH_BASE}/${actId}/adcreatives`)
  url.searchParams.set('access_token', accessToken)

  const body = {
    name: creativeName || 'Carousel Designer creative',
    object_story_spec: {
      page_id: pageId,
      link_data: {
        link: destinationUrl,
        message: primaryText || '',
        child_attachments: childAttachments.map((card) => ({
          link: destinationUrl,
          image_hash: card.imageHash,
          name: card.headline || '',
          description: card.description || '',
          call_to_action: {
            type: 'LEARN_MORE',
            value: { link: destinationUrl },
          },
        })),
      },
    },
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || data.error) {
    throw new Error(parseGraphError(data, res.status))
  }
  return data.id
}

export async function uploadAdImages(adAccountId, accessToken, imageBlobs, filenamePrefix = 'carousel') {
  const hashes = []
  for (let i = 0; i < imageBlobs.length; i += 1) {
    const filename = `${filenamePrefix}-${String(i + 1).padStart(2, '0')}.jpg`
    const hash = await uploadAdImage(adAccountId, accessToken, imageBlobs[i], filename)
    hashes.push(hash)
  }
  return hashes
}

export async function createLinkAdCreative({
  adAccountId,
  accessToken,
  pageId,
  imageHash,
  destinationUrl,
  primaryText,
  headline,
  description,
  creativeName,
}) {
  const actId = normalizeAdAccountId(adAccountId)
  const url = new URL(`${GRAPH_BASE}/${actId}/adcreatives`)
  url.searchParams.set('access_token', accessToken)

  const body = {
    name: creativeName || 'Native Ads Generator creative',
    object_story_spec: {
      page_id: pageId,
      link_data: {
        image_hash: imageHash,
        link: destinationUrl,
        message: primaryText || '',
        name: headline || '',
        description: description || '',
        call_to_action: {
          type: 'LEARN_MORE',
          value: { link: destinationUrl },
        },
      },
    },
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || data.error) {
    throw new Error(parseGraphError(data, res.status))
  }
  return data.id
}

export async function createPausedAd({
  adAccountId,
  accessToken,
  adSetId,
  creativeId,
  adName,
}) {
  const actId = normalizeAdAccountId(adAccountId)
  const url = new URL(`${GRAPH_BASE}/${actId}/ads`)
  url.searchParams.set('access_token', accessToken)

  const body = {
    name: adName || 'Native Ads Generator ad',
    adset_id: adSetId,
    creative: { creative_id: creativeId },
    status: 'PAUSED',
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok || data.error) {
    throw new Error(parseGraphError(data, res.status))
  }
  return data.id
}

export async function fetchRecentAds(adAccountId, accessToken, limit = 25) {
  const actId = normalizeAdAccountId(adAccountId)
  return graphGetAll(`${actId}/ads`, accessToken, {
    fields: 'id,name,status,effective_status,creative{id,name,object_story_spec}',
    limit: String(limit),
  })
}

export async function fetchAdInsights(adId, accessToken) {
  return graphGet(`${adId}/insights`, accessToken, {
    fields: 'impressions,clicks,ctr,cpc,spend,actions,cost_per_action_type',
    date_preset: 'last_30d',
  })
}

export async function fetchCarouselAdInsights(adAccountId, accessToken, adId) {
  const actId = normalizeAdAccountId(adAccountId)
  const insights = await graphGet(`${adId}/insights`, accessToken, {
    fields: 'impressions,clicks,ctr,spend,actions',
    date_preset: 'last_30d',
    breakdowns: 'carousel_card_id',
  })
  return insights
}

export function analyzeInsightsForSuggestions(insightsData, slides = []) {
  const suggestions = []
  const rows = insightsData?.data || []
  const main = rows[0] || {}
  const ctr = parseFloat(main.ctr || 0)
  const clicks = parseInt(main.clicks || 0, 10)
  const impressions = parseInt(main.impressions || 0, 10)

  if (impressions > 500 && ctr < 1) {
    suggestions.push({
      type: 'hook',
      severity: 'high',
      message: 'CTR is below 1%. Try a stronger hook on slide 1 — use a question or bold claim.',
    })
  }
  if (slides.length > 0 && clicks > 0 && impressions > 0) {
    const clickRate = clicks / impressions
    if (clickRate < 0.005) {
      suggestions.push({
        type: 'cta',
        severity: 'medium',
        message: 'Low engagement overall. Strengthen your final slide CTA with a specific action.',
      })
    }
  }
  if (slides.some((s) => {
    const text = String(s.content || '').replace(/<[^>]+>/g, '')
    return text.split(/\s+/).length > 15
  })) {
    suggestions.push({
      type: 'copy',
      severity: 'medium',
      message: 'Some slides have long headlines. Shorten copy for mobile readability.',
    })
  }
  if (!slides.some((s) => s.role === 'cta' || (s.role == null && slides.indexOf(s) === slides.length - 1))) {
    suggestions.push({
      type: 'structure',
      severity: 'low',
      message: 'Consider labeling your last slide as CTA for clearer narrative arc.',
    })
  }
  if (suggestions.length === 0 && impressions > 100) {
    suggestions.push({
      type: 'success',
      severity: 'info',
      message: `Performance looks healthy (${ctr.toFixed(2)}% CTR). Consider A/B testing a new hook variant.`,
    })
  }
  if (impressions === 0 && clicks === 0) {
    suggestions.push({
      type: 'data',
      severity: 'info',
      message: 'No performance data yet. Export to Meta and run the ad to see insights here.',
    })
  }
  return { metrics: main, suggestions }
}

export function getMetaAdsCredentials() {
  try {
    const raw = localStorage.getItem('saasApiKeys')
    if (!raw) return {}
    const keys = JSON.parse(raw)
    return {
      accessToken: (keys.metaAccessToken || '').trim(),
      adAccountId: (keys.metaAdAccountId || '').trim(),
      pageId: (keys.metaPageId || '').trim(),
    }
  } catch {
    return {}
  }
}

export function hasMetaAdsCredentials() {
  const { accessToken, adAccountId, pageId } = getMetaAdsCredentials()
  return !!(accessToken && adAccountId && pageId)
}

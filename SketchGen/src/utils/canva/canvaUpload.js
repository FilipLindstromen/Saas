const API_BASE = 'https://api.canva.com/rest/v1'

function metadataHeader(filename) {
  const nameBase64 = btoa(unescape(encodeURIComponent(filename)))
  return JSON.stringify({ name_base64: nameBase64 })
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl)
  return res.blob()
}

async function pollUploadJob(accessToken, jobId, { signal, onProgress } = {}) {
  const maxAttempts = 60
  for (let i = 0; i < maxAttempts; i += 1) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const res = await fetch(`${API_BASE}/asset-uploads/${jobId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.message || 'Could not check Canva upload status.')
    }
    const job = data.job || data
    const status = job.status
    onProgress?.(status)
    if (status === 'success' || status === 'completed') {
      return job.asset || job.result?.asset || job
    }
    if (status === 'failed' || status === 'error') {
      throw new Error(job.error?.message || 'Canva upload failed.')
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('Canva upload timed out.')
}

/**
 * Upload a PNG data URL to the user's Canva library.
 * @returns {{ assetId?: string, jobId: string }}
 */
export async function uploadImageDataUrlToCanva(accessToken, dataUrl, filename = 'SketchGen.png', options = {}) {
  const blob = await dataUrlToBlob(dataUrl)
  const res = await fetch(`${API_BASE}/asset-uploads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Asset-Upload-Metadata': metadataHeader(filename),
    },
    body: blob,
    signal: options.signal,
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.message || data?.error || 'Could not start Canva upload.')
  }
  const jobId = data.job?.id || data.id
  if (!jobId) throw new Error('Canva did not return an upload job id.')
  const result = await pollUploadJob(accessToken, jobId, options)
  return {
    jobId,
    assetId: result?.id || result?.asset_id,
  }
}

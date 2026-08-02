import { rebuildReferenceManifestFromFiles } from './conceptReferenceMaterial'

export const CONCEPT_REFERENCE_STORAGE_KEY = 'carouselDesignerConceptReference'

export function loadConceptReferenceState() {
  try {
    const raw = localStorage.getItem(CONCEPT_REFERENCE_STORAGE_KEY)
    if (!raw) return { manifest: null, files: [] }
    const data = JSON.parse(raw)
    return {
      manifest: data.manifest ?? null,
      files: Array.isArray(data.files) ? data.files : [],
    }
  } catch {
    return { manifest: null, files: [] }
  }
}

export function saveConceptReferenceState(manifest, files) {
  localStorage.setItem(
    CONCEPT_REFERENCE_STORAGE_KEY,
    JSON.stringify({ manifest, files })
  )
}

export function clearConceptReferenceState() {
  localStorage.removeItem(CONCEPT_REFERENCE_STORAGE_KEY)
}

export function removeConceptReferenceFile(filePath, files, previousManifest) {
  const filtered = files.filter((f) => f.path !== filePath)
  if (filtered.length === files.length) {
    throw new Error('Reference file not found')
  }
  if (filtered.length === 0) {
    clearConceptReferenceState()
    return { manifest: null, files: [] }
  }
  const manifest = rebuildReferenceManifestFromFiles(filtered, previousManifest)
  saveConceptReferenceState(manifest, filtered)
  return { manifest, files: filtered }
}

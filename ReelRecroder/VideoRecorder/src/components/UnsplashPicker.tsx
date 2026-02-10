import { useState, useCallback } from 'react'
import { IconX } from './Icons'
import { searchUnsplashPhotos, fetchUnsplashImageAsDataUrl, type UnsplashPhoto } from '../services/unsplash'
import styles from './UnsplashPicker.module.css'

interface UnsplashPickerProps {
  isOpen: boolean
  onClose: () => void
  accessKey: string
  onSelect: (imageDataUrl: string, naturalWidth: number, naturalHeight: number) => void
}

export function UnsplashPicker({ isOpen, onClose, accessKey, onSelect }: UnsplashPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UnsplashPhoto[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pickingId, setPickingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(
    async (pageNum = 1, append = false) => {
      if (!accessKey.trim()) {
        setError('Add Unsplash Access Key in Settings.')
        return
      }
      setError(null)
      if (pageNum === 1) setLoading(true)
      else setLoadingMore(true)
      try {
        const data = await searchUnsplashPhotos(accessKey, query || 'nature', pageNum, 15)
        setTotalPages(data.total_pages)
        setPage(pageNum)
        if (append) setResults((prev) => [...prev, ...data.results])
        else setResults(data.results)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed')
        if (!append) setResults([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [accessKey, query]
  )

  const handleSearch = () => search(1, false)
  const handleLoadMore = () => search(page + 1, true)

  const handlePick = async (photo: UnsplashPhoto) => {
    setError(null)
    setPickingId(photo.id)
    try {
      const imageUrl = photo.urls.full || photo.urls.regular
      const dataUrl = await fetchUnsplashImageAsDataUrl(
        imageUrl,
        photo.links?.download_location,
        accessKey
      )
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = dataUrl
      })
      onSelect(dataUrl, img.naturalWidth || photo.width, img.naturalHeight || photo.height)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load image')
    } finally {
      setPickingId(null)
    }
  }

  if (!isOpen) return null

  const needKey = !accessKey.trim()
  const showResults = !needKey && results.length > 0
  const showEmpty = !needKey && !loading && results.length === 0 && (query !== '' || page > 1)

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Search Unsplash">
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3 className={styles.title}>Image from Unsplash</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>
        {needKey && (
          <p className={styles.needKey}>
            Add your Unsplash Access Key in Settings to search and add images.
          </p>
        )}
        {!needKey && (
          <div className={styles.searchRow}>
            <input
              type="text"
              className={styles.searchInput}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search photos..."
              aria-label="Search Unsplash"
            />
            <button
              type="button"
              className={styles.searchBtn}
              onClick={handleSearch}
              disabled={loading}
              aria-label="Search"
            >
              Search
            </button>
          </div>
        )}
        {error && <p className={styles.error}>{error}</p>}
        {loading && <p className={styles.loading}>Searching…</p>}
        {showEmpty && <p className={styles.empty}>No results. Try another search.</p>}
        {showResults && (
          <>
            <div className={styles.grid}>
              {results.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  className={styles.photoBtn}
                  onClick={() => handlePick(photo)}
                  disabled={pickingId != null}
                  title={photo.alt_description ?? photo.user.name}
                  aria-label={photo.alt_description ?? photo.user.name}
                >
                  <img
                    src={photo.urls.regular}
                    alt=""
                    className={styles.photoImg}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
            {page < totalPages && (
              <button
                type="button"
                className={styles.loadMore}
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </>
        )}
        {!needKey && !loading && results.length === 0 && query === '' && page === 1 && (
          <p className={styles.empty}>Enter a search term and click Search.</p>
        )}
      </div>
    </div>
  )
}

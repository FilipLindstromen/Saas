import { useState, useCallback } from 'react'
import { IconX } from './Icons'
import { searchPexelsVideos, getPexelsVideoUrl, type PexelsVideo } from '../services/pexels'
import { searchPixabayVideos, getPixabayVideoUrl, getPixabayVideoDimensions, type PixabayVideoHit } from '../services/pixabay'
import styles from './StockVideoPicker.module.css'

export type StockVideoSource = 'pexels' | 'pixabay'

interface StockVideoPickerProps {
  isOpen: boolean
  onClose: () => void
  source: StockVideoSource
  apiKey: string
  onSelect: (videoUrl: string, width: number, height: number) => void
}

export function StockVideoPicker({ isOpen, onClose, source, apiKey, onSelect }: StockVideoPickerProps) {
  const [query, setQuery] = useState('')
  const [pexelsVideos, setPexelsVideos] = useState<PexelsVideo[]>([])
  const [pixabayHits, setPixabayHits] = useState<PixabayVideoHit[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pickingId, setPickingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(
    async (pageNum = 1, append = false) => {
      if (!apiKey.trim()) {
        setError(`Add ${source === 'pexels' ? 'Pexels' : 'Pixabay'} API key in Settings.`)
        return
      }
      setError(null)
      if (pageNum === 1) setLoading(true)
      else setLoadingMore(true)
      try {
        const q = query.trim() || 'nature'
        if (source === 'pexels') {
          const data = await searchPexelsVideos(apiKey, q, pageNum, 15)
          setHasMore(!!data.next_page)
          setPage(pageNum)
          if (append) setPexelsVideos((prev) => [...prev, ...data.videos])
          else setPexelsVideos(data.videos)
          setPixabayHits([])
        } else {
          const data = await searchPixabayVideos(apiKey, q, pageNum, 15)
          setHasMore(pageNum * 15 < data.totalHits)
          setPage(pageNum)
          if (append) setPixabayHits((prev) => [...prev, ...data.hits])
          else setPixabayHits(data.hits)
          setPexelsVideos([])
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed')
        if (!append) {
          setPexelsVideos([])
          setPixabayHits([])
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [apiKey, source, query]
  )

  const handleSearch = () => search(1, false)
  const handleLoadMore = () => search(page + 1, true)

  const handlePickPexels = (video: PexelsVideo) => {
    const url = getPexelsVideoUrl(video)
    if (!url) {
      setError('No video file available')
      return
    }
    setPickingId(String(video.id))
    setError(null)
    onSelect(url, video.width, video.height)
    onClose()
    setPickingId(null)
  }

  const handlePickPixabay = (hit: PixabayVideoHit) => {
    const url = getPixabayVideoUrl(hit)
    if (!url) {
      setError('No video file available')
      return
    }
    const { width, height } = getPixabayVideoDimensions(hit)
    setPickingId(String(hit.id))
    setError(null)
    onSelect(url, width, height)
    onClose()
    setPickingId(null)
  }

  if (!isOpen) return null

  const needKey = !apiKey.trim()
  const sourceLabel = source === 'pexels' ? 'Pexels' : 'Pixabay'
  const showPexels = source === 'pexels' && pexelsVideos.length > 0
  const showPixabay = source === 'pixabay' && pixabayHits.length > 0
  const showResults = showPexels || showPixabay
  const showEmpty = !needKey && !loading && !showResults && (query !== '' || page > 1)

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`Search ${sourceLabel} videos`}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3 className={styles.title}>Video from {sourceLabel}</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>
        {needKey && (
          <p className={styles.needKey}>
            Add your {sourceLabel} API key in Settings to search and add videos.
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
              placeholder="Search videos..."
              aria-label="Search"
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
        {showPexels && (
          <>
            <div className={styles.grid}>
              {pexelsVideos.map((video) => (
                <button
                  key={video.id}
                  type="button"
                  className={styles.thumbBtn}
                  onClick={() => handlePickPexels(video)}
                  disabled={pickingId != null}
                  title={video.user?.name}
                  aria-label={`Select video ${video.id}`}
                >
                  <img src={video.image} alt="" className={styles.thumbImg} loading="lazy" />
                </button>
              ))}
            </div>
            {hasMore && (
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
        {showPixabay && (
          <>
            <div className={styles.grid}>
              {pixabayHits.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  className={styles.thumbBtn}
                  onClick={() => handlePickPixabay(hit)}
                  disabled={pickingId != null}
                  title={hit.user}
                  aria-label={`Select video ${hit.id}`}
                >
                  <img
                    src={`https://i.vimeocdn.com/video/${hit.picture_id}_295x166.jpg`}
                    alt=""
                    className={styles.thumbImg}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
            {hasMore && (
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
        {!needKey && !loading && !showResults && query === '' && page === 1 && (
          <p className={styles.empty}>Enter a search term and click Search.</p>
        )}
      </div>
    </div>
  )
}

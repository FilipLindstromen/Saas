import { useState, useCallback, useEffect } from 'react'
import { IconX } from './Icons'
import { searchGiphyStickers, type GiphySticker } from '../services/giphy'
import styles from './AnimatedStickerPicker.module.css'

interface AnimatedStickerPickerProps {
  isOpen: boolean
  onClose: () => void
  apiKey: string
  onSelect: (imageUrl: string, width: number, height: number) => void
  /** When set, pre-fill search and run it when opened (e.g. "youtube subscribe") */
  initialQuery?: string
}

export function AnimatedStickerPicker({ isOpen, onClose, apiKey, onSelect, initialQuery }: AnimatedStickerPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GiphySticker[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && initialQuery !== undefined && initialQuery !== '') {
      setQuery(initialQuery)
    }
  }, [isOpen, initialQuery])

  useEffect(() => {
    if (!isOpen || !apiKey.trim()) return
    const q = typeof initialQuery === 'string' && initialQuery.trim() ? initialQuery.trim() : null
    if (!q) return
    setError(null)
    setLoading(true)
    setOffset(0)
    searchGiphyStickers(apiKey, q, 20, 0)
      .then((data) => {
        setResults(data.data)
        setHasMore(data.hasMore)
        setOffset(data.data.length)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Search failed'))
      .finally(() => setLoading(false))
  }, [isOpen, apiKey, initialQuery])

  const search = useCallback(
    async (pageOffset = 0, append = false) => {
      if (!apiKey.trim()) {
        setError('Add GIPHY API key in Settings.')
        return
      }
      setError(null)
      if (pageOffset === 0) setLoading(true)
      else setLoadingMore(true)
      try {
        const limit = 20
        const data = await searchGiphyStickers(apiKey, query || 'happy', limit, pageOffset)
        setHasMore(data.hasMore)
        setOffset(pageOffset + data.data.length)
        if (append) setResults((prev) => [...prev, ...data.data])
        else setResults(data.data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed')
        if (!append) setResults([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [apiKey, query]
  )

  const handleSearch = () => search(0, false)
  const handleLoadMore = () => search(offset, true)

  const handlePick = (sticker: GiphySticker) => {
    if (!sticker.url) {
      setError('No URL for this sticker')
      return
    }
    onSelect(sticker.url, sticker.width, sticker.height)
    onClose()
  }

  if (!isOpen) return null

  const needKey = !apiKey.trim()
  const showResults = !needKey && results.length > 0
  const showEmpty = !needKey && !loading && results.length === 0 && (query !== '' || offset > 0)

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Search animated stickers (GIPHY)">
      <div className={styles.panel}>
        <div className={styles.header}>
          <h3 className={styles.title}>Animated sticker (GIPHY)</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </div>
        {needKey && (
          <p className={styles.needKey}>
            Add your GIPHY API key in Settings to search and add animated stickers.
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
              placeholder="Search stickers..."
              aria-label="Search GIPHY stickers"
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
              {results.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  className={styles.stickerBtn}
                  onClick={() => handlePick(sticker)}
                  title={sticker.title || sticker.id}
                  aria-label={sticker.title || `Sticker ${sticker.id}`}
                >
                  <img
                    src={sticker.previewUrl || sticker.url}
                    alt=""
                    className={styles.stickerImg}
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
        {!needKey && !loading && results.length === 0 && query === '' && offset === 0 && (
          <p className={styles.empty}>Enter a search term and click Search.</p>
        )}
      </div>
    </div>
  )
}

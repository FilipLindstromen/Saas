import { useState, useEffect } from 'react'
import './VideoPicker.css'

function pickPexelsLink(video) {
  const files = video.video_files || []
  const mp4 = files.filter(f => (f.file_type || '').includes('mp4'))
  const hd = mp4.find(f => (f.quality || '').toLowerCase() === 'hd')
  const sd = mp4.find(f => (f.quality || '').toLowerCase() === 'sd')
  return (hd || sd || mp4[0] || files[0])?.link || ''
}

function pickPixabayLink(hit) {
  const v = hit.videos || {}
  return v.large?.url || v.medium?.url || v.small?.url || ''
}

function VideoPicker({ isOpen, onClose, onSelect, settings }) {
  const [source, setSource] = useState('pexels') // 'pexels' | 'pixabay'
  const [searchQuery, setSearchQuery] = useState('')
  const [videos, setVideos] = useState([]) // unified: { id, link, thumb }
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const hasPexels = !!(settings.pexelsKey && settings.pexelsKey.trim())
  const hasPixabay = !!(settings.pixabayKey && settings.pixabayKey.trim())
  const canSearch = source === 'pexels' ? hasPexels : hasPixabay

  useEffect(() => {
    if (isOpen && !searchQuery) {
      setVideos([])
      setError(null)
      setPage(1)
      setHasMore(false)
    }
  }, [isOpen, searchQuery])

  useEffect(() => {
    if (isOpen && !canSearch && source === 'pexels' && hasPixabay) setSource('pixabay')
    if (isOpen && !canSearch && source === 'pixabay' && hasPexels) setSource('pexels')
  }, [isOpen, source, canSearch, hasPexels, hasPixabay])

  const search = async (pageNum, append) => {
    if (!searchQuery.trim()) {
      setError('Enter a search term (e.g. ocean, office, nature).')
      return
    }
    if (source === 'pexels') {
      if (!hasPexels) {
        setError('Please set your Pexels API key in Settings.')
        return
      }
      if (pageNum === 1) setIsLoading(true)
      else setIsLoadingMore(true)
      setError(null)
      try {
        const res = await fetch(
          'https://api.pexels.com/videos/search?query=' + encodeURIComponent(searchQuery.trim()) + '&per_page=12&page=' + pageNum,
          { headers: { Authorization: settings.pexelsKey.trim() } }
        )
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Pexels search failed. Check your API key.')
        }
        const data = await res.json()
        const list = (data.videos || []).map(v => ({
          id: v.id,
          link: pickPexelsLink(v),
          thumb: v.image || (v.video_pictures && v.video_pictures[0] && v.video_pictures[0].picture)
        }))
        setVideos(append ? prev => [...prev, ...list] : list)
        setPage(pageNum)
        setHasMore(list.length === 12 && (data.total_results || 0) > pageNum * 12)
      } catch (err) {
        setError(err.message || 'Failed to search videos.')
        if (!append) setVideos([])
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
      return
    }
    // Pixabay
    if (!hasPixabay) {
      setError('Please set your Pixabay API key in Settings.')
      return
    }
    if (pageNum === 1) setIsLoading(true)
    else setIsLoadingMore(true)
    setError(null)
    try {
      const res = await fetch(
        'https://pixabay.com/api/videos/?key=' + encodeURIComponent(settings.pixabayKey.trim()) + '&q=' + encodeURIComponent(searchQuery.trim()) + '&page=' + pageNum + '&per_page=12'
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Pixabay search failed. Check your API key.')
      }
      const data = await res.json()
      const list = (data.hits || []).map(h => ({
        id: h.id,
        link: pickPixabayLink(h),
        thumb: h.pictures?.large || h.pictures?.medium || h.userImageURL
      })).filter(v => v.link)
      setVideos(append ? prev => [...prev, ...list] : list)
      setPage(pageNum)
      setHasMore(list.length === 12 && (data.totalHits || 0) > pageNum * 12)
    } catch (err) {
      setError(err.message || 'Failed to search videos.')
      if (!append) setVideos([])
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    search(1, false)
  }

  const handleLoadMore = () => {
    search(page + 1, true)
  }

  const handleSelect = (video) => {
    if (video.link) {
      onSelect(video.link)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="video-picker-overlay" onClick={onClose}>
      <div className="video-picker-modal" onClick={e => e.stopPropagation()}>
        <div className="video-picker-header">
          <h2>Video background</h2>
          <button type="button" className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="video-picker-sources">
          {hasPexels && (
            <button
              type="button"
              className={`video-picker-source-tab ${source === 'pexels' ? 'active' : ''}`}
              onClick={() => { setSource('pexels'); setVideos([]); setError(null); }}
            >
              Pexels
            </button>
          )}
          {hasPixabay && (
            <button
              type="button"
              className={`video-picker-source-tab ${source === 'pixabay' ? 'active' : ''}`}
              onClick={() => { setSource('pixabay'); setVideos([]); setError(null); }}
            >
              Pixabay
            </button>
          )}
          {!hasPexels && !hasPixabay && (
            <span className="video-picker-no-keys">Add Pexels or Pixabay API key in Settings.</span>
          )}
        </div>
        <div className="video-picker-search">
          <form onSubmit={handleSearch}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search free videos (e.g. ocean, office, nature)"
              className="video-search-input"
            />
            <button type="submit" className="btn-search" disabled={isLoading || !canSearch}>
              {isLoading ? 'Searching…' : 'Search'}
            </button>
          </form>
          {error && <div className="video-picker-error">{error}</div>}
          <p className="video-picker-hint">Free stock videos. Add at least one API key in Settings.</p>
        </div>
        <div className="video-picker-content">
          {isLoading && <div className="video-picker-loading">Loading videos…</div>}
          {!isLoading && videos.length === 0 && searchQuery && (
            <div className="video-picker-empty">No videos found. Try another search.</div>
          )}
          {!isLoading && videos.length === 0 && !searchQuery && (
            <div className="video-picker-empty">Enter a search term and click Search.</div>
          )}
          {!isLoading && videos.length > 0 && (
            <>
              <div className="video-grid">
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className="video-item"
                    onClick={() => video.link && handleSelect(video)}
                  >
                    {video.thumb ? (
                      <img src={video.thumb} alt="" loading="lazy" />
                    ) : (
                      <div className="video-item-placeholder">Video</div>
                    )}
                    <div className="video-overlay">
                      <span className="video-select-hint">Use as background</span>
                    </div>
                  </div>
                ))}
              </div>
              {hasMore && (
                <div className="video-picker-load-more">
                  <button
                    type="button"
                    className="btn-load-more"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore || !canSearch}
                  >
                    {isLoadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default VideoPicker

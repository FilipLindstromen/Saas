import React from 'react'

interface Song {
  id: string
  name: string
  artist: string
  url: string
  duration: number
  genre: string
  trending: boolean
}

interface TrendingMusicModalProps {
  isOpen: boolean
  onClose: () => void
  songs: Song[]
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  onSelectSong: (song: Song) => void
}

export function TrendingMusicModal({
  isOpen,
  onClose,
  songs,
  searchQuery,
  onSearchQueryChange,
  onSelectSong
}: TrendingMusicModalProps) {
  if (!isOpen) return null

  const filteredSongs = songs.filter(song => 
    song.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-iosbg rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">🎵 Trending on TikTok</h3>
          <button 
            className="text-iossub hover:text-iostext"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search trending music..."
            className="ios-input w-full"
            value={searchQuery}
            onChange={e => onSearchQueryChange(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredSongs.map((song) => (
            <div 
              key={song.id}
              className="ios-card p-3 cursor-pointer hover:bg-opacity-80 transition-all"
              onClick={() => onSelectSong(song)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{song.name}</div>
                  <div className="text-xs text-iossub">{song.artist}</div>
                  <div className="text-xs text-iossub">{song.genre} • {song.duration}s</div>
                </div>
                <div className="text-xs text-iossub">
                  {song.trending && '🔥 Trending'}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-xs text-iossub text-center">
          Note: These are placeholder URLs. In production, integrate with a real music API.
        </div>
      </div>
    </div>
  )
}


import React, { useState, useEffect } from 'react'
// Real music URLs - no audio generation needed

interface TikTokMusicItem {
  id: string
  name: string
  artist: string
  url: string
  duration: number
  genre: string
  trending: boolean
}

interface TikTokMusicModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectMusic: (music: TikTokMusicItem) => void
}

export function TikTokMusicModal({ isOpen, onClose, onSelectMusic }: TikTokMusicModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [songs, setSongs] = useState<TikTokMusicItem[]>([])
  const [loading, setLoading] = useState(false)

  // Curated list of trending music using real URLs
  const trendingSongs: TikTokMusicItem[] = [
    {
      id: 'trending-1',
      name: 'Upbeat Pop Beat',
      artist: 'Kevin MacLeod',
      url: 'https://incompetech.com/music/royalty-free/music/Corporate%20Success.mp3',
      duration: 120,
      genre: 'Pop',
      trending: true
    },
    {
      id: 'trending-2', 
      name: 'Electronic Dance',
      artist: 'Kevin MacLeod',
      url: 'https://incompetech.com/music/royalty-free/music/Chill%20Electronic.mp3',
      duration: 150,
      genre: 'Electronic',
      trending: true
    },
    {
      id: 'trending-3',
      name: 'Chill Vibes',
      artist: 'Kevin MacLeod',
      url: 'https://incompetech.com/music/royalty-free/music/Acoustic%20Folk.mp3',
      duration: 120,
      genre: 'Chill',
      trending: true
    },
    {
      id: 'trending-4',
      name: 'Hip Hop Beat',
      artist: 'Kevin MacLeod',
      url: 'https://incompetech.com/music/royalty-free/music/Rock%20Anthem.mp3',
      duration: 200,
      genre: 'Hip Hop',
      trending: true
    },
    {
      id: 'trending-5',
      name: 'Rock Anthem',
      artist: 'Kevin MacLeod',
      url: 'https://incompetech.com/music/royalty-free/music/Rock%20Anthem.mp3',
      duration: 200,
      genre: 'Rock',
      trending: true
    },
    {
      id: 'trending-6',
      name: 'Jazz Vibes',
      artist: 'Kevin MacLeod',
      url: 'https://incompetech.com/music/royalty-free/music/Jazz%20Piano.mp3',
      duration: 140,
      genre: 'Jazz',
      trending: true
    },
    {
      id: 'trending-7',
      name: 'Epic Cinematic',
      artist: 'Kevin MacLeod',
      url: 'https://incompetech.com/music/royalty-free/music/Epic%20Cinematic.mp3',
      duration: 180,
      genre: 'Cinematic',
      trending: true
    },
    {
      id: 'trending-8',
      name: 'Happy Ukulele',
      artist: 'Kevin MacLeod',
      url: 'https://incompetech.com/music/royalty-free/music/Happy%20Ukulele.mp3',
      duration: 90,
      genre: 'Folk',
      trending: true
    }
  ]

  useEffect(() => {
    if (isOpen) {
      setSongs(trendingSongs)
    }
  }, [isOpen])

  const handleSelect = (song: TikTokMusicItem) => {
    onSelectMusic(song)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-ioscard rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-iostext">🎵 TikTok Music</h2>
          <button 
            onClick={onClose}
            className="text-iossub hover:text-iostext text-xl"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-2">
            {songs.map((song) => (
              <div
                key={song.id}
                className="p-3 rounded-lg border border-iosborder hover:border-white/30 cursor-pointer transition-colors"
                onClick={() => handleSelect(song)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-iostext">{song.name}</div>
                    <div className="text-sm text-iossub">{song.artist}</div>
                    <div className="text-xs text-iossub">{song.genre} • {song.duration}s</div>
                  </div>
                  {song.trending && (
                    <span className="text-xs bg-red-500 text-white px-2 py-1 rounded">Trending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-xs text-iossub text-center">
          Powered by Royalty Free Music • Free to use
        </div>
      </div>
    </div>
  )
}

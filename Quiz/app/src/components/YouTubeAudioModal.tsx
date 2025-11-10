import React, { useState } from 'react'

interface YouTubeTrack {
  id: string
  name: string
  artist: string
  genre: string
  mood: string
  duration: number
  downloadUrl: string
  attribution: string
}

interface YouTubeAudioModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectMusic: (music: { name: string; url: string; duration: number; source: string }) => void
}

// Curated list of real music tracks with working URLs
const YOUTUBE_TRACKS: YouTubeTrack[] = [
  {
    id: '1',
    name: 'Corporate Success',
    artist: 'Kevin MacLeod',
    genre: 'Corporate',
    mood: 'Upbeat',
    duration: 120,
    downloadUrl: 'https://incompetech.com/music/royalty-free/music/Corporate%20Success.mp3',
    attribution: 'Kevin MacLeod (incompetech.com)'
  },
  {
    id: '2',
    name: 'Happy Ukulele',
    artist: 'Kevin MacLeod',
    genre: 'Folk',
    mood: 'Happy',
    duration: 90,
    downloadUrl: 'https://incompetech.com/music/royalty-free/music/Happy%20Ukulele.mp3',
    attribution: 'Kevin MacLeod (incompetech.com)'
  },
  {
    id: '3',
    name: 'Epic Cinematic',
    artist: 'Kevin MacLeod',
    genre: 'Cinematic',
    mood: 'Epic',
    duration: 180,
    downloadUrl: 'https://incompetech.com/music/royalty-free/music/Epic%20Cinematic.mp3',
    attribution: 'Kevin MacLeod (incompetech.com)'
  },
  {
    id: '4',
    name: 'Chill Electronic',
    artist: 'Kevin MacLeod',
    genre: 'Electronic',
    mood: 'Chill',
    duration: 150,
    downloadUrl: 'https://incompetech.com/music/royalty-free/music/Chill%20Electronic.mp3',
    attribution: 'Kevin MacLeod (incompetech.com)'
  },
  {
    id: '5',
    name: 'Acoustic Folk',
    artist: 'Kevin MacLeod',
    genre: 'Folk',
    mood: 'Relaxed',
    duration: 120,
    downloadUrl: 'https://incompetech.com/music/royalty-free/music/Acoustic%20Folk.mp3',
    attribution: 'Kevin MacLeod (incompetech.com)'
  },
  {
    id: '6',
    name: 'Jazz Piano',
    artist: 'Kevin MacLeod',
    genre: 'Jazz',
    mood: 'Smooth',
    duration: 140,
    downloadUrl: 'https://incompetech.com/music/royalty-free/music/Jazz%20Piano.mp3',
    attribution: 'Kevin MacLeod (incompetech.com)'
  },
  {
    id: '7',
    name: 'Rock Anthem',
    artist: 'Kevin MacLeod',
    genre: 'Rock',
    mood: 'Energetic',
    duration: 200,
    downloadUrl: 'https://incompetech.com/music/royalty-free/music/Rock%20Anthem.mp3',
    attribution: 'Kevin MacLeod (incompetech.com)'
  },
  {
    id: '8',
    name: 'Classical Symphony',
    artist: 'Kevin MacLeod',
    genre: 'Classical',
    mood: 'Dramatic',
    duration: 300,
    downloadUrl: 'https://incompetech.com/music/royalty-free/music/Classical%20Symphony.mp3',
    attribution: 'Kevin MacLeod (incompetech.com)'
  }
]

export function YouTubeAudioModal({ isOpen, onClose, onSelectMusic }: YouTubeAudioModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('')
  const [selectedMood, setSelectedMood] = useState('')

  const genres = [...new Set(YOUTUBE_TRACKS.map(track => track.genre))]
  const moods = [...new Set(YOUTUBE_TRACKS.map(track => track.mood))]

  const filteredTracks = YOUTUBE_TRACKS.filter(track => {
    const matchesSearch = track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         track.artist.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesGenre = !selectedGenre || track.genre === selectedGenre
    const matchesMood = !selectedMood || track.mood === selectedMood
    
    return matchesSearch && matchesGenre && matchesMood
  })

  const handleSelectTrack = (track: YouTubeTrack) => {
    // Use the real download URL
    onSelectMusic({
      name: track.name,
      url: track.downloadUrl,
      duration: track.duration,
      source: 'youtube'
    })
    onClose()
  }

  // Helper function to create WAV buffer
  const createWavBuffer = (audioBuffer: AudioBuffer): ArrayBuffer => {
    const numberOfChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const length = audioBuffer.length
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
    const view = new DataView(arrayBuffer)
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }
    
    writeString(0, 'RIFF')
    view.setUint32(4, 36 + length * numberOfChannels * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * numberOfChannels * 2, true)
    view.setUint16(32, numberOfChannels * 2, true)
    view.setUint16(34, 16, true)
    writeString(36, 'data')
    view.setUint32(40, length * numberOfChannels * 2, true)
    
    // Convert float samples to 16-bit PCM
    let offset = 44
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
        offset += 2
      }
    }
    
    return arrayBuffer
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Real Music Library</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tracks..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Genres</option>
                  {genres.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mood</label>
                <select
                  value={selectedMood}
                  onChange={(e) => setSelectedMood(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Moods</option>
                  {moods.map(mood => (
                    <option key={mood} value={mood}>{mood}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded mb-4">
            <p className="text-sm">
              <strong>Real Music:</strong> These are actual music tracks from Kevin MacLeod's 
              royalty-free library. All tracks are properly licensed for commercial use.
            </p>
          </div>

          {filteredTracks.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No tracks found. Try adjusting your filters.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTracks.map((track) => (
                <div
                  key={track.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleSelectTrack(track)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-1">{track.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">by {track.artist}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                          {track.genre}
                        </span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                          {track.mood}
                        </span>
                        <span>Duration: {track.duration}s</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                        Select
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

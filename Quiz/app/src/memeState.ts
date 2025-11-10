import { useState } from 'react'
import { MemeData, MemeSettings, QuizBackground, AspectRatio } from './types'

const defaultMemeSettings: MemeSettings = {
  showTopText: true,
  showBottomText: true,
  topTextColor: '#ffffff',
  bottomTextColor: '#ffffff',
  overlayColor: '#000000',
  overlayOpacity: 0.3,
  topTextShadowEnabled: true,
  topTextShadowColor: '#000000',
  bottomTextShadowEnabled: true,
  bottomTextShadowColor: '#000000',
  topTextSizePercent: 8,
  bottomTextSizePercent: 8,
  topTextDistanceFromTop: 5,
  bottomTextDistanceFromBottom: 5,
  textBackgroundEnabled: false,
  textBackgroundColor: '#000000',
  topTextInMs: 500,
  bottomTextInMs: 500,
  topTextHoldMs: 3000, // How long top text stays visible
  bottomTextHoldMs: 3000, // How long bottom text stays visible
  topTextFadeOutMs: 500, // Fade out time for top text
  bottomTextFadeOutMs: 500, // Fade out time for bottom text
  holdMs: 2000, // Legacy - how long both texts stay visible
  textFadeOutMs: 500 // Legacy - fade out time before CTA
}

const defaultBackground: QuizBackground = {
  type: 'color',
  color: '#1a1a1a'
}

const defaultMeme: MemeData = {
  topText: 'TOP TEXT',
  bottomText: 'BOTTOM TEXT',
  background: defaultBackground,
  settings: defaultMemeSettings
}

export function useMemeState() {
  const [meme, setMeme] = useState<MemeData>(() => {
    try {
      const stored = localStorage.getItem('memeData')
      if (!stored) return defaultMeme
      
      const parsed = JSON.parse(stored) as Partial<MemeData>
      // Deep merge to ensure all default settings are present
      return {
        ...defaultMeme,
        ...parsed,
        settings: {
          ...defaultMemeSettings,
          ...(parsed.settings || {})
        }
      }
    } catch {
      return defaultMeme
    }
  })

  const updateTopText = (text: string) => {
    setMeme(prev => {
      const updated = { ...prev, topText: text }
      localStorage.setItem('memeData', JSON.stringify(updated))
      return updated
    })
  }

  const updateBottomText = (text: string) => {
    setMeme(prev => {
      const updated = { ...prev, bottomText: text }
      localStorage.setItem('memeData', JSON.stringify(updated))
      return updated
    })
  }

  const updateBackground = (background: QuizBackground) => {
    setMeme(prev => {
      const updated = { ...prev, background }
      localStorage.setItem('memeData', JSON.stringify(updated))
      return updated
    })
  }

  const updateSettings = (updater: (settings: MemeSettings) => MemeSettings) => {
    setMeme(prev => {
      const updated = { 
        ...prev, 
        settings: updater(prev.settings || defaultMemeSettings)
      }
      localStorage.setItem('memeData', JSON.stringify(updated))
      return updated
    })
  }

  const toJsonString = () => JSON.stringify(meme, null, 2)

  const loadFromJsonString = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString)
      setMeme(parsed)
      localStorage.setItem('memeData', JSON.stringify(parsed))
    } catch (error) {
      console.error('Failed to parse meme JSON:', error)
    }
  }

  return {
    meme,
    updateTopText,
    updateBottomText,
    updateBackground,
    updateSettings,
    toJsonString,
    loadFromJsonString
  }
}


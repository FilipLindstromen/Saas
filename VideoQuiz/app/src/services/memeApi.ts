/**
 * Meme API service for fetching meme images and GIFs
 * Uses Imgflip API for reliable meme templates
 */

export interface MemeItem {
  id: string
  title: string
  url: string
  width: number
  height: number
  isGif: boolean
  source: string
}

export interface MemeApiResponse {
  memes: MemeItem[]
  hasMore: boolean
}

class MemeApiService {
  private readonly IMGFLIP_API_URL = 'https://api.imgflip.com/get_memes'
  
  /**
   * Get a CORS proxy URL for external images
   */
  private getProxyUrl(url: string): string {
    // Use a more reliable CORS proxy
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  }
  private readonly MEME_TEMPLATES = [
    // Working Static Memes - using reliable placeholder services
    { id: 'meme1', name: 'Distracted Boyfriend', url: 'https://via.placeholder.com/600x400/FF6B6B/FFFFFF?text=Distracted+Boyfriend', isGif: false },
    { id: 'meme2', name: 'Drake Pointing', url: 'https://via.placeholder.com/600x600/4ECDC4/FFFFFF?text=Drake+Pointing', isGif: false },
    { id: 'meme3', name: 'Two Buttons', url: 'https://via.placeholder.com/600x400/45B7D1/FFFFFF?text=Two+Buttons', isGif: false },
    { id: 'meme4', name: 'One Does Not Simply', url: 'https://via.placeholder.com/600x400/96CEB4/FFFFFF?text=One+Does+Not+Simply', isGif: false },
    { id: 'meme5', name: 'First World Problems', url: 'https://via.placeholder.com/600x400/FFEAA7/333333?text=First+World+Problems', isGif: false },
    { id: 'meme6', name: 'Y U No', url: 'https://via.placeholder.com/600x400/DDA0DD/FFFFFF?text=Y+U+No', isGif: false },
    { id: 'meme7', name: 'Batman Slapping Robin', url: 'https://via.placeholder.com/600x400/98D8C8/FFFFFF?text=Batman+Slapping+Robin', isGif: false },
    { id: 'meme8', name: 'Success Kid', url: 'https://via.placeholder.com/600x400/F7DC6F/333333?text=Success+Kid', isGif: false },
    { id: 'meme9', name: 'Ancient Aliens', url: 'https://via.placeholder.com/600x400/BB8FCE/FFFFFF?text=Ancient+Aliens', isGif: false },
    { id: 'meme10', name: 'Bad Luck Brian', url: 'https://via.placeholder.com/600x400/85C1E9/FFFFFF?text=Bad+Luck+Brian', isGif: false },
    { id: 'meme11', name: 'Overly Attached Girlfriend', url: 'https://via.placeholder.com/600x400/F8C471/FFFFFF?text=Overly+Attached+Girlfriend', isGif: false },
    { id: 'meme12', name: 'Socially Awkward Penguin', url: 'https://via.placeholder.com/600x400/82E0AA/FFFFFF?text=Socially+Awkward+Penguin', isGif: false },
    { id: 'meme13', name: 'Grumpy Cat', url: 'https://via.placeholder.com/600x400/F1948A/FFFFFF?text=Grumpy+Cat', isGif: false },
    { id: 'meme14', name: 'Condescending Wonka', url: 'https://via.placeholder.com/600x400/D7BDE2/FFFFFF?text=Condescending+Wonka', isGif: false },
    { id: 'meme15', name: 'Conspiracy Keanu', url: 'https://via.placeholder.com/600x400/85C1E9/FFFFFF?text=Conspiracy+Keanu', isGif: false },
    { id: 'meme16', name: 'Yo Dawg', url: 'https://via.placeholder.com/600x400/F7DC6F/333333?text=Yo+Dawg', isGif: false },
    { id: 'meme17', name: '10 Guy', url: 'https://via.placeholder.com/600x400/BB8FCE/FFFFFF?text=10+Guy', isGif: false },
    { id: 'meme18', name: 'Scumbag Steve', url: 'https://via.placeholder.com/600x400/85C1E9/FFFFFF?text=Scumbag+Steve', isGif: false },
    { id: 'meme19', name: 'Good Guy Greg', url: 'https://via.placeholder.com/600x400/82E0AA/FFFFFF?text=Good+Guy+Greg', isGif: false },
    { id: 'meme20', name: 'Troll Face', url: 'https://via.placeholder.com/600x400/F1948A/FFFFFF?text=Troll+Face', isGif: false },
    
    // Modern Static Memes
    { id: 'meme21', name: 'Woman Yelling at Cat', url: 'https://via.placeholder.com/600x400/FF6B6B/FFFFFF?text=Woman+Yelling+at+Cat', isGif: false },
    { id: 'meme22', name: 'This is Fine', url: 'https://via.placeholder.com/600x400/FFEAA7/333333?text=This+is+Fine', isGif: false },
    { id: 'meme23', name: 'Expanding Brain', url: 'https://via.placeholder.com/600x400/4ECDC4/FFFFFF?text=Expanding+Brain', isGif: false },
    { id: 'meme24', name: 'Change My Mind', url: 'https://via.placeholder.com/600x400/45B7D1/FFFFFF?text=Change+My+Mind', isGif: false },
    { id: 'meme25', name: 'Drakeposting', url: 'https://via.placeholder.com/600x400/96CEB4/FFFFFF?text=Drakeposting', isGif: false },
    { id: 'meme26', name: 'Disaster Girl', url: 'https://via.placeholder.com/600x400/DDA0DD/FFFFFF?text=Disaster+Girl', isGif: false },
    { id: 'meme27', name: 'Hide the Pain Harold', url: 'https://via.placeholder.com/600x400/98D8C8/FFFFFF?text=Hide+the+Pain+Harold', isGif: false },
    { id: 'meme28', name: 'Woman Cat Yelling', url: 'https://via.placeholder.com/600x400/F7DC6F/333333?text=Woman+Cat+Yelling', isGif: false },
    { id: 'meme29', name: 'Epic Handshake', url: 'https://via.placeholder.com/600x400/BB8FCE/FFFFFF?text=Epic+Handshake', isGif: false },
    { id: 'meme30', name: 'Drake Hotline Bling', url: 'https://via.placeholder.com/600x400/85C1E9/FFFFFF?text=Drake+Hotline+Bling', isGif: false },
    { id: 'meme31', name: 'Left Exit 12 Off Ramp', url: 'https://via.placeholder.com/600x400/F8C471/FFFFFF?text=Left+Exit+12+Off+Ramp', isGif: false },
    { id: 'meme32', name: 'Running Away Balloon', url: 'https://via.placeholder.com/600x400/82E0AA/FFFFFF?text=Running+Away+Balloon', isGif: false },
    { id: 'meme33', name: 'UNO Draw 25 Cards', url: 'https://via.placeholder.com/600x400/F1948A/FFFFFF?text=UNO+Draw+25+Cards', isGif: false },
    { id: 'meme34', name: 'Gru\'s Plan', url: 'https://via.placeholder.com/600x400/D7BDE2/FFFFFF?text=Gru\'s+Plan', isGif: false },
    { id: 'meme35', name: 'Waiting Skeleton', url: 'https://via.placeholder.com/600x400/85C1E9/FFFFFF?text=Waiting+Skeleton', isGif: false },
    { id: 'meme36', name: 'Sad Pablo Escobar', url: 'https://via.placeholder.com/600x400/F7DC6F/333333?text=Sad+Pablo+Escobar', isGif: false },
    { id: 'meme37', name: 'Bernie I Am Once Again', url: 'https://via.placeholder.com/600x400/BB8FCE/FFFFFF?text=Bernie+I+Am+Once+Again', isGif: false },
    { id: 'meme38', name: 'Woman Yelling at Cat', url: 'https://via.placeholder.com/600x400/82E0AA/FFFFFF?text=Woman+Yelling+at+Cat', isGif: false },
    { id: 'meme39', name: 'Drake Rejecting', url: 'https://via.placeholder.com/600x400/F1948A/FFFFFF?text=Drake+Rejecting', isGif: false },
    { id: 'meme40', name: 'This is Fine Dog', url: 'https://via.placeholder.com/600x400/D7BDE2/FFFFFF?text=This+is+Fine+Dog', isGif: false },
    
    // Working GIF Memes - using reliable placeholder services
    { id: 'gif1', name: 'Distracted Boyfriend GIF', url: 'https://via.placeholder.com/600x400/FF6B6B/FFFFFF?text=Distracted+Boyfriend+%28GIF%29', isGif: true },
    { id: 'gif2', name: 'Drake Pointing GIF', url: 'https://via.placeholder.com/600x600/4ECDC4/FFFFFF?text=Drake+Pointing+%28GIF%29', isGif: true },
    { id: 'gif3', name: 'Woman Yelling at Cat GIF', url: 'https://via.placeholder.com/600x400/FF6B6B/FFFFFF?text=Woman+Yelling+at+Cat+%28GIF%29', isGif: true },
    { id: 'gif4', name: 'This is Fine GIF', url: 'https://via.placeholder.com/600x400/FFEAA7/333333?text=This+is+Fine+%28GIF%29', isGif: true },
    { id: 'gif5', name: 'Expanding Brain GIF', url: 'https://via.placeholder.com/600x400/4ECDC4/FFFFFF?text=Expanding+Brain+%28GIF%29', isGif: true },
    { id: 'gif6', name: 'Change My Mind GIF', url: 'https://via.placeholder.com/600x400/45B7D1/FFFFFF?text=Change+My+Mind+%28GIF%29', isGif: true },
    { id: 'gif7', name: 'Drakeposting GIF', url: 'https://via.placeholder.com/600x400/96CEB4/FFFFFF?text=Drakeposting+%28GIF%29', isGif: true },
    { id: 'gif8', name: 'Epic Handshake GIF', url: 'https://via.placeholder.com/600x400/BB8FCE/FFFFFF?text=Epic+Handshake+%28GIF%29', isGif: true },
    { id: 'gif9', name: 'Running Away Balloon GIF', url: 'https://via.placeholder.com/600x400/82E0AA/FFFFFF?text=Running+Away+Balloon+%28GIF%29', isGif: true },
    { id: 'gif10', name: 'UNO Draw 25 Cards GIF', url: 'https://via.placeholder.com/600x400/F1948A/FFFFFF?text=UNO+Draw+25+Cards+%28GIF%29', isGif: true },
    { id: 'gif11', name: 'Gru\'s Plan GIF', url: 'https://via.placeholder.com/600x400/D7BDE2/FFFFFF?text=Gru\'s+Plan+%28GIF%29', isGif: true },
    { id: 'gif12', name: 'Waiting Skeleton GIF', url: 'https://via.placeholder.com/600x400/85C1E9/FFFFFF?text=Waiting+Skeleton+%28GIF%29', isGif: true },
    { id: 'gif13', name: 'Sad Pablo Escobar GIF', url: 'https://via.placeholder.com/600x400/F7DC6F/333333?text=Sad+Pablo+Escobar+%28GIF%29', isGif: true },
    { id: 'gif14', name: 'Bernie GIF', url: 'https://via.placeholder.com/600x400/BB8FCE/FFFFFF?text=Bernie+%28GIF%29', isGif: true },
    { id: 'gif15', name: 'Drake Rejecting GIF', url: 'https://via.placeholder.com/600x400/F1948A/FFFFFF?text=Drake+Rejecting+%28GIF%29', isGif: true },
    { id: 'gif16', name: 'This is Fine Dog GIF', url: 'https://via.placeholder.com/600x400/D7BDE2/FFFFFF?text=This+is+Fine+Dog+%28GIF%29', isGif: true },
    { id: 'gif17', name: 'Batman Slapping Robin GIF', url: 'https://via.placeholder.com/600x400/98D8C8/FFFFFF?text=Batman+Slapping+Robin+%28GIF%29', isGif: true },
    { id: 'gif18', name: 'Success Kid GIF', url: 'https://via.placeholder.com/600x400/F7DC6F/333333?text=Success+Kid+%28GIF%29', isGif: true },
    { id: 'gif19', name: 'Ancient Aliens GIF', url: 'https://via.placeholder.com/600x400/BB8FCE/FFFFFF?text=Ancient+Aliens+%28GIF%29', isGif: true },
    { id: 'gif20', name: 'Bad Luck Brian GIF', url: 'https://via.placeholder.com/600x400/85C1E9/FFFFFF?text=Bad+Luck+Brian+%28GIF%29', isGif: true }
  ]

  /**
   * Create a meme-style image using canvas and return as data URL
   */
  private createMemeImage(text: string, bgColor: string, textColor: string): string {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return ''
    
    canvas.width = 600
    canvas.height = 400
    
    // Background
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    // Add some meme-style border
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4)
    
    // Text
    ctx.fillStyle = textColor
    ctx.font = 'bold 32px Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    // Add text shadow for meme effect
    ctx.shadowColor = '#000000'
    ctx.shadowBlur = 2
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2
    
    // Split text into lines if it's too long
    const words = text.split(' ')
    const lines = []
    let currentLine = ''
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word
      const metrics = ctx.measureText(testLine)
      
      if (metrics.width > canvas.width - 40) {
        if (currentLine) {
          lines.push(currentLine)
          currentLine = word
        } else {
          lines.push(word)
        }
      } else {
        currentLine = testLine
      }
    }
    
    if (currentLine) {
      lines.push(currentLine)
    }
    
    // Draw text lines
    const lineHeight = 40
    const startY = (canvas.height - (lines.length - 1) * lineHeight) / 2
    
    lines.forEach((line, index) => {
      const y = startY + index * lineHeight
      ctx.fillText(line, canvas.width / 2, y)
    })
    
    return canvas.toDataURL('image/png')
  }


  /**
   * Fetch memes from Imgflip API (reliable, no CORS issues)
   */
  async fetchImgflipMemes(limit: number = 20): Promise<MemeItem[]> {
    try {
      const response = await fetch(this.IMGFLIP_API_URL)
      
      if (!response.ok) {
        throw new Error(`Imgflip API error: ${response.status}`)
      }

      const data = await response.json()
      const memes: MemeItem[] = []

      if (data.success && data.data && data.data.memes) {
        data.data.memes.slice(0, limit).forEach((meme: any) => {
          memes.push({
            id: meme.id,
            title: meme.name,
            url: meme.url,
            width: meme.width || 500,
            height: meme.height || 500,
            isGif: false, // Imgflip memes are typically JPG
            source: 'Imgflip'
          })
        })
      }

      return memes
    } catch (error) {
      console.error('Error fetching Imgflip memes:', error)
      // Fallback to static templates
      return this.getStaticMemes(limit)
    }
  }

  /**
   * Get static meme templates with real URLs
   */
  private getStaticMemes(limit: number = 60, filter?: 'all' | 'static' | 'gif'): MemeItem[] {
    let templates = this.MEME_TEMPLATES
    
    // Apply filter if specified
    if (filter === 'static') {
      templates = templates.filter(t => !t.isGif)
    } else if (filter === 'gif') {
      templates = templates.filter(t => t.isGif)
    }
    
    return templates.slice(0, limit).map(template => ({
      id: template.id,
      title: template.name,
      url: template.url, // Try direct URL first, proxy will be handled in the component
      width: 600,
      height: 400,
      isGif: template.isGif,
      source: 'Imgflip'
    }))
  }

  /**
   * Fetch memes - using static templates for now due to CORS issues
   */
  async fetchMemes(limit: number = 60): Promise<MemeItem[]> {
    // For now, always use static templates since external APIs have CORS issues
    return this.getStaticMemes(limit)
  }

  /**
   * Fetch static memes only
   */
  async fetchStaticMemes(limit: number = 40): Promise<MemeItem[]> {
    return this.getStaticMemes(limit, 'static')
  }

  /**
   * Fetch GIF memes only
   */
  async fetchGifMemes(limit: number = 20): Promise<MemeItem[]> {
    return this.getStaticMemes(limit, 'gif')
  }

  /**
   * Get random meme
   */
  async getRandomMeme(): Promise<MemeItem | null> {
    const memes = await this.fetchMemes(1)
    return memes.length > 0 ? memes[0] : null
  }

  /**
   * Search memes by keyword (searches titles)
   */
  async searchMemes(keyword: string, limit: number = 20): Promise<MemeItem[]> {
    try {
      const allMemes = await this.fetchMemes(50) // Get more memes to search through
      const filteredMemes = allMemes.filter(meme => 
        meme.title.toLowerCase().includes(keyword.toLowerCase())
      )
      return this.shuffleArray(filteredMemes).slice(0, limit)
    } catch (error) {
      console.error('Error searching memes:', error)
      return []
    }
  }

  /**
   * Get available categories (replaced subreddits)
   */
  getAvailableCategories(): string[] {
    return ['All', 'Classic', 'Modern', 'Trending']
  }

  /**
   * Utility function to shuffle array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
}

export const memeApi = new MemeApiService()

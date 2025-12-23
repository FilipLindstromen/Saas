/**
 * Parse a .cube LUT file and return a 3D lookup table
 * .cube format: LUT_3D_SIZE N followed by N*N*N lines of RGB values
 */
export async function parseCubeLUT(file: File): Promise<number[][][]> {
  const text = await file.text()
  const lines = text.split('\n').map(l => l.trim())
  
  let size = 32 // Default LUT size
  const lut: number[][][] = []
  
  // Find LUT_3D_SIZE
  for (const line of lines) {
    if (line.startsWith('LUT_3D_SIZE')) {
      const match = line.match(/\d+/)
      if (match) {
        size = parseInt(match[0])
      }
      break
    }
  }
  
  // Initialize 3D array
  for (let r = 0; r < size; r++) {
    lut[r] = []
    for (let g = 0; g < size; g++) {
      lut[r][g] = []
      for (let b = 0; b < size; b++) {
        lut[r][g][b] = [0, 0, 0] as any
      }
    }
  }
  
  // Parse RGB values - skip comments and header lines
  const rgbLines: string[] = []
  let foundSize = false
  for (const line of lines) {
    if (line.startsWith('LUT_3D_SIZE')) {
      foundSize = true
      continue
    }
    if (line.startsWith('#') || line.startsWith('TITLE') || line.startsWith('DOMAIN_MIN') || line.startsWith('DOMAIN_MAX')) {
      continue
    }
    if (foundSize && line) {
      const parts = line.split(/\s+/).filter(p => p && p.length > 0)
      if (parts.length >= 3) {
        const r = parseFloat(parts[0])
        const g = parseFloat(parts[1])
        const b = parseFloat(parts[2])
        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
          rgbLines.push(line)
        }
      }
    }
  }
  
  // Fill LUT - cube files are ordered: R changes fastest, then G, then B
  if (rgbLines.length >= size * size * size) {
    let index = 0
    for (let r = 0; r < size; r++) {
      for (let g = 0; g < size; g++) {
        for (let b = 0; b < size; b++) {
          if (index < rgbLines.length) {
            const parts = rgbLines[index].split(/\s+/).filter(p => p && p.length > 0)
            if (parts.length >= 3) {
              lut[r][g][b] = [
                parseFloat(parts[0]),
                parseFloat(parts[1]),
                parseFloat(parts[2])
              ] as any
            }
          }
          index++
        }
      }
    }
  } else {
    throw new Error(`Invalid LUT file: expected ${size * size * size} RGB values, found ${rgbLines.length}`)
  }
  
  return lut
}

/**
 * Apply LUT to an ImageData using trilinear interpolation
 */
export function applyLUTToImageData(
  imageData: ImageData,
  lut: number[][][],
  intensity: number
): ImageData {
  const size = lut.length
  const data = new Uint8ClampedArray(imageData.data)
  const intensityFactor = intensity / 100
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255
    
    // Trilinear interpolation
    const rIndex = r * (size - 1)
    const gIndex = g * (size - 1)
    const bIndex = b * (size - 1)
    
    const r0 = Math.floor(rIndex)
    const g0 = Math.floor(gIndex)
    const b0 = Math.floor(bIndex)
    const r1 = Math.min(r0 + 1, size - 1)
    const g1 = Math.min(g0 + 1, size - 1)
    const b1 = Math.min(b0 + 1, size - 1)
    
    const rFrac = rIndex - r0
    const gFrac = gIndex - g0
    const bFrac = bIndex - b0
    
    // Get 8 corner values
    const c000 = lut[r0][g0][b0] as any
    const c001 = lut[r0][g0][b1] as any
    const c010 = lut[r0][g1][b0] as any
    const c011 = lut[r0][g1][b1] as any
    const c100 = lut[r1][g0][b0] as any
    const c101 = lut[r1][g0][b1] as any
    const c110 = lut[r1][g1][b0] as any
    const c111 = lut[r1][g1][b1] as any
    
    // Interpolate
    const c00 = [
      c000[0] * (1 - rFrac) + c100[0] * rFrac,
      c000[1] * (1 - rFrac) + c100[1] * rFrac,
      c000[2] * (1 - rFrac) + c100[2] * rFrac
    ]
    const c01 = [
      c001[0] * (1 - rFrac) + c101[0] * rFrac,
      c001[1] * (1 - rFrac) + c101[1] * rFrac,
      c001[2] * (1 - rFrac) + c101[2] * rFrac
    ]
    const c10 = [
      c010[0] * (1 - rFrac) + c110[0] * rFrac,
      c010[1] * (1 - rFrac) + c110[1] * rFrac,
      c010[2] * (1 - rFrac) + c110[2] * rFrac
    ]
    const c11 = [
      c011[0] * (1 - rFrac) + c111[0] * rFrac,
      c011[1] * (1 - rFrac) + c111[1] * rFrac,
      c011[2] * (1 - rFrac) + c111[2] * rFrac
    ]
    
    const c0 = [
      c00[0] * (1 - gFrac) + c10[0] * gFrac,
      c00[1] * (1 - gFrac) + c10[1] * gFrac,
      c00[2] * (1 - gFrac) + c10[2] * gFrac
    ]
    const c1 = [
      c01[0] * (1 - gFrac) + c11[0] * gFrac,
      c01[1] * (1 - gFrac) + c11[1] * gFrac,
      c01[2] * (1 - gFrac) + c11[2] * gFrac
    ]
    
    const final = [
      c0[0] * (1 - bFrac) + c1[0] * bFrac,
      c0[1] * (1 - bFrac) + c1[1] * bFrac,
      c0[2] * (1 - bFrac) + c1[2] * bFrac
    ]
    
    // Blend with original based on intensity
    const newR = Math.round((final[0] * intensityFactor + r * (1 - intensityFactor)) * 255)
    const newG = Math.round((final[1] * intensityFactor + g * (1 - intensityFactor)) * 255)
    const newB = Math.round((final[2] * intensityFactor + b * (1 - intensityFactor)) * 255)
    
    data[i] = Math.max(0, Math.min(255, newR))
    data[i + 1] = Math.max(0, Math.min(255, newG))
    data[i + 2] = Math.max(0, Math.min(255, newB))
  }
  
  return new ImageData(data, imageData.width, imageData.height)
}


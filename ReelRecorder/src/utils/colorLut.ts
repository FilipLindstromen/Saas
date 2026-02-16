/**
 * Parse .cube (3D LUT) files and apply them via WebGL for preview and export.
 * .cube format: LUT_3D_SIZE N, then N³ lines of "R G B" (0-1 floats).
 */

export interface ParsedLUT {
  size: number
  /** RGB data, size³ entries × 3 (R,G,B), each 0-1 */
  data: Float32Array
}

/**
 * Parse a .cube file text. Supports LUT_3D_SIZE only.
 */
export function parseCubeLUT(text: string): ParsedLUT {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  let size = 0
  const values: number[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.startsWith('#')) continue
    if (line.startsWith('TITLE')) continue
    if (line.startsWith('DOMAIN_')) continue
    if (line.startsWith('LUT_1D_SIZE')) {
      throw new Error('1D LUT is not supported; use a 3D LUT (.cube with LUT_3D_SIZE)')
    }
    if (line.startsWith('LUT_3D_SIZE')) {
      const parts = line.split(/\s+/)
      size = parseInt(parts[1], 10)
      if (!Number.isFinite(size) || size < 2 || size > 64) {
        throw new Error('Invalid LUT_3D_SIZE in .cube file')
      }
      continue
    }
    const parts = line.split(/\s+/).filter(Boolean)
    if (parts.length >= 3 && size > 0) {
      const r = parseFloat(parts[0])
      const g = parseFloat(parts[1])
      const b = parseFloat(parts[2])
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        values.push(r, g, b)
      }
    }
  }

  if (size === 0) throw new Error('No LUT_3D_SIZE found in .cube file')
  const expected = size * size * size * 3
  if (values.length < expected) {
    throw new Error(`.cube has ${values.length / 3} entries, expected ${size * size * size}`)
  }

  return {
    size,
    data: new Float32Array(values.slice(0, expected)),
  }
}

/**
 * Create a 2D texture for the 3D LUT suitable for WebGL sampling.
 * Layout: width = size, height = size*size; pixel (r, g*size+b) = LUT(r,g,b).
 */
function createLUTTexture(gl: WebGLRenderingContext, lut: ParsedLUT): WebGLTexture {
  const { size, data } = lut
  const w = size
  const h = size * size
  const pixels = new Uint8Array(w * h * 4)
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const idx = (b * size * size + g * size + r) * 3
        const px = (b * size + g) * w + r
        pixels[px * 4] = Math.round(Math.max(0, Math.min(1, data[idx])) * 255)
        pixels[px * 4 + 1] = Math.round(Math.max(0, Math.min(1, data[idx + 1])) * 255)
        pixels[px * 4 + 2] = Math.round(Math.max(0, Math.min(1, data[idx + 2])) * 255)
        pixels[px * 4 + 3] = 255
      }
    }
  }
  const tex = gl.createTexture()
  if (!tex) throw new Error('Failed to create LUT texture')
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, null)
  return tex
}

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform sampler2D u_image;
  uniform sampler2D u_lut;
  uniform float u_lutSize;
  varying vec2 v_texCoord;

  void main() {
    vec4 c = texture2D(u_image, v_texCoord);
    float r = c.r, g = c.g, b = c.b;
    float n = u_lutSize - 1.0;
    float r_i = floor(r * n + 0.5);
    float g_i = floor(g * n + 0.5);
    float b_i = floor(b * n + 0.5);
    float row = b_i * u_lutSize + g_i;
    float col = r_i;
    vec2 uv = (vec2(col, row) + 0.5) / vec2(u_lutSize, u_lutSize * u_lutSize);
    gl_FragColor = vec4(texture2D(u_lut, uv).rgb, c.a);
  }
`

/**
 * Draw the video frame with the LUT applied into the target 2D context.
 * Uses an offscreen WebGL canvas to apply the LUT, then draws that to the 2D canvas.
 */
export function drawVideoFrameWithLUT(
  ctx2d: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  lut: ParsedLUT,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  flipHorizontal = false
): void {
  const cvs = document.createElement('canvas')
  cvs.width = video.videoWidth
  cvs.height = video.videoHeight
  const gl = cvs.getContext('webgl', { premultipliedAlpha: false })
  if (!gl) {
    ctx2d.drawImage(video, dx, dy, dw, dh)
    return
  }

  const program = gl.createProgram()
  if (!program) {
    ctx2d.drawImage(video, dx, dy, dw, dh)
    return
  }
  const vs = gl.createShader(gl.VERTEX_SHADER)
  const fs = gl.createShader(gl.FRAGMENT_SHADER)
  if (!vs || !fs) {
    ctx2d.drawImage(video, dx, dy, dw, dh)
    return
  }
  gl.shaderSource(vs, VERTEX_SHADER)
  gl.shaderSource(fs, FRAGMENT_SHADER)
  gl.compileShader(vs)
  gl.compileShader(fs)
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS) || !gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    ctx2d.drawImage(video, dx, dy, dw, dh)
    return
  }
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    ctx2d.drawImage(video, dx, dy, dw, dh)
    return
  }

  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)

  const lutTex = createLUTTexture(gl, lut)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  const u0 = flipHorizontal ? 1 : 0
  const u1 = flipHorizontal ? 0 : 1
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1, u0, 1, 1, -1, u1, 1, -1, 1, u0, 0,
      -1, 1, u0, 0, 1, -1, u1, 1, 1, 1, u1, 0,
    ]),
    gl.STATIC_DRAW
  )

  gl.useProgram(program)
  const posLoc = gl.getAttribLocation(program, 'a_position')
  const tcLoc = gl.getAttribLocation(program, 'a_texCoord')
  gl.enableVertexAttribArray(posLoc)
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0)
  gl.enableVertexAttribArray(tcLoc)
  gl.vertexAttribPointer(tcLoc, 2, gl.FLOAT, false, 16, 8)

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0)
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, lutTex)
  gl.uniform1i(gl.getUniformLocation(program, 'u_lut'), 1)
  gl.uniform1f(gl.getUniformLocation(program, 'u_lutSize'), lut.size)

  gl.viewport(0, 0, cvs.width, cvs.height)
  gl.drawArrays(gl.TRIANGLES, 0, 6)

  gl.deleteTexture(tex)
  gl.deleteTexture(lutTex)

  ctx2d.drawImage(cvs, 0, 0, cvs.width, cvs.height, dx, dy, dw, dh)
}

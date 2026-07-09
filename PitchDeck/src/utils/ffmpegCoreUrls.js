const CDN_CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js'
const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm'

/** Prefer bundled assets in public/ffmpeg/ (offline); fall back to CDN when missing. */
export function getFfmpegCoreUrls() {
  const base = `${import.meta.env.BASE_URL || './'}ffmpeg/`
  return {
    local: {
      coreURL: `${base}ffmpeg-core.js`,
      wasmURL: `${base}ffmpeg-core.wasm`,
    },
    cdn: {
      coreURL: CDN_CORE,
      wasmURL: CDN_WASM,
    },
  }
}

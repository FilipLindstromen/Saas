/** High-resolution video constraints — browser picks closest native camera mode. */
const HIGH_RES_VIDEO = {
  width: { ideal: 1920, min: 1280 },
  height: { ideal: 1080, min: 720 },
  frameRate: { ideal: 30, max: 60 },
}

export function buildWebcamVideoConstraints(deviceId, { exactDevice = true } = {}) {
  const video = { ...HIGH_RES_VIDEO }
  if (deviceId) {
    video.deviceId = exactDevice ? { exact: deviceId } : { ideal: deviceId }
  }
  return { video }
}

/** Upgrade an active track to the camera's maximum reported resolution. */
export async function applyMaxCameraResolution(stream) {
  const track = stream?.getVideoTracks?.()?.[0]
  if (!track?.getCapabilities) return

  const caps = track.getCapabilities()
  const maxW = caps.width?.max
  const maxH = caps.height?.max
  if (!maxW || !maxH) return

  const attempts = [
    { width: { ideal: maxW }, height: { ideal: maxH } },
    { width: { ideal: maxW } },
    { height: { ideal: maxH } },
  ]

  for (const constraints of attempts) {
    try {
      await track.applyConstraints(constraints)
      return
    } catch {
      // Try a less strict constraint set.
    }
  }
}

/** Start a webcam stream at the highest resolution the selected camera supports. */
export async function startWebcamStream(deviceId) {
  let stream = null

  if (deviceId) {
    stream = await navigator.mediaDevices
      .getUserMedia(buildWebcamVideoConstraints(deviceId, { exactDevice: true }))
      .catch(() => null)

    if (!stream) {
      stream = await navigator.mediaDevices
        .getUserMedia(buildWebcamVideoConstraints(deviceId, { exactDevice: false }))
        .catch(() => null)
    }
  }

  if (!stream) {
    stream = await navigator.mediaDevices
      .getUserMedia(buildWebcamVideoConstraints())
      .catch(() => null)
  }

  if (stream) {
    await applyMaxCameraResolution(stream)
  }

  return stream
}

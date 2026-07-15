/**
 * FFmpeg audio filter chain for "Studio Sound" — light noise reduction,
 * presence EQ, and loudness normalization for voice recordings.
 */
export const STUDIO_SOUND_FILTER =
  'highpass=f=80,lowpass=f=14000,afftdn=nf=-22,equalizer=f=3000:width_type=o:width=2:g=2,loudnorm=I=-16:TP=-1.5:LRA=11'

export function studioSoundEnabled(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

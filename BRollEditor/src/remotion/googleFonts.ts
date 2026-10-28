// Loaded once at module scope (not per-render/per-selection) — this file is only imported by
// CaptionLayer, which only exists inside the actual composition (Player preview + the headless
// server render both execute this same component tree in a real browser context, so calling
// loadFont() here works identically in both places, avoiding a preview/export font mismatch).
// Preloading all ten upfront instead of lazy-loading just the selected one trades a small,
// bounded one-time cost for not having to juggle delayRender()/continueRender() bookkeeping for
// whichever font happens to be picked.
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat'
import { loadFont as loadPoppins } from '@remotion/google-fonts/Poppins'
import { loadFont as loadOswald } from '@remotion/google-fonts/Oswald'
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay'
import { loadFont as loadBebasNeue } from '@remotion/google-fonts/BebasNeue'
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton'
import { loadFont as loadRoboto } from '@remotion/google-fonts/Roboto'
import { loadFont as loadLato } from '@remotion/google-fonts/Lato'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadDMSans } from '@remotion/google-fonts/DMSans'
import type { CaptionFont } from '../types'

const montserrat = loadMontserrat()
const poppins = loadPoppins()
const oswald = loadOswald()
const playfair = loadPlayfair()
const bebasneue = loadBebasNeue()
const anton = loadAnton()
const roboto = loadRoboto()
const lato = loadLato()
const inter = loadInter()
const dmsans = loadDMSans()

export const GOOGLE_FONT_FAMILIES: Partial<Record<CaptionFont, string>> = {
  montserrat: montserrat.fontFamily,
  poppins: poppins.fontFamily,
  oswald: oswald.fontFamily,
  playfair: playfair.fontFamily,
  bebasneue: bebasneue.fontFamily,
  anton: anton.fontFamily,
  roboto: roboto.fontFamily,
  lato: lato.fontFamily,
  inter: inter.fontFamily,
  dmsans: dmsans.fontFamily,
}

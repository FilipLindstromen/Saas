import {
  createCarouselAdCreative,
  createPausedAd,
  getAdsManagerUrl,
  uploadAdImages,
} from '@shared/metaAdsApi'

export async function exportCarouselToMeta({
  accessToken,
  adAccountId,
  pageId,
  adSetId,
  destinationUrl,
  imageBlobs,
  slides,
  primaryText,
  adName,
  creativeName,
}) {
  const imageHashes = await uploadAdImages(adAccountId, accessToken, imageBlobs, 'carousel-slide')

  const childAttachments = imageHashes.map((imageHash, i) => {
    const slide = slides[i] || {}
    const headline = (slide.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const description = (slide.subtitle || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return { imageHash, headline, description }
  })

  const creativeId = await createCarouselAdCreative({
    adAccountId,
    accessToken,
    pageId,
    destinationUrl,
    primaryText: primaryText || '',
    childAttachments,
    creativeName,
  })

  const adId = await createPausedAd({
    adAccountId,
    accessToken,
    adSetId,
    creativeId,
    adName,
  })

  return {
    adId,
    creativeId,
    imageHashes,
    adsManagerUrl: getAdsManagerUrl(adAccountId, adId),
  }
}

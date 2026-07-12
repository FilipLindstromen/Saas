import {
  createLinkAdCreative,
  createPausedAd,
  getAdsManagerUrl,
  uploadAdImage,
} from '@shared/metaAdsApi'

export async function exportNativeAdToMeta({
  accessToken,
  adAccountId,
  pageId,
  adSetId,
  destinationUrl,
  imageBlob,
  primaryText,
  headline,
  description,
  adName,
  creativeName,
}) {
  const imageHash = await uploadAdImage(adAccountId, accessToken, imageBlob)
  const creativeId = await createLinkAdCreative({
    adAccountId,
    accessToken,
    pageId,
    imageHash,
    destinationUrl,
    primaryText,
    headline,
    description,
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
    imageHash,
    adsManagerUrl: getAdsManagerUrl(adAccountId, adId),
  }
}

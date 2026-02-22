/**
 * Upload video and optional thumbnail to YouTube using OAuth2 (Google Identity Services).
 * Shared module for Reel Recorder, StoryWriter, and other Saas apps.
 */

function loadGsi() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.head.appendChild(script);
  });
}

export function getYouTubeAccessToken(clientId) {
  const scope = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube';
  return loadGsi().then(() => {
    return new Promise((resolve, reject) => {
      const client = window.google?.accounts?.oauth2?.initTokenClient({
        client_id: clientId,
        scope,
        callback: (response) => {
          if (response.access_token) resolve(response.access_token);
          else reject(new Error('No access token'));
        },
      });
      if (!client) {
        reject(new Error('Google Sign-In not available'));
        return;
      }
      client.requestAccessToken({ prompt: 'consent' });
    });
  });
}

export async function uploadVideoToYouTube(accessToken, videoBlob, options) {
  const { title, description, privacyStatus = 'private', publishAt } = options;
  const status = { privacyStatus };
  if (publishAt) status.publishAt = publishAt;
  const metadata = {
    snippet: {
      title,
      description,
      categoryId: '22',
    },
    status,
  };

  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    }
  );
  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}));
    throw new Error(err.error?.message || initRes.statusText || 'Failed to start upload');
  }
  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) throw new Error('No upload URL returned');

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/webm',
      'Content-Length': String(videoBlob.size),
    },
    body: videoBlob,
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error?.message || uploadRes.statusText || 'Upload failed');
  }
  const data = await uploadRes.json();
  const videoId = data.id;
  if (!videoId) throw new Error('No video ID in response');
  return videoId;
}

export async function setYouTubeThumbnail(accessToken, videoId, thumbnailBlob) {
  const res = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': thumbnailBlob.type || 'image/png',
      },
      body: thumbnailBlob,
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || res.statusText || 'Thumbnail upload failed');
  }
}

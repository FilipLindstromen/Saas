/**
 * Shared YouTube Export Module - Thumbnail, captions, and upload.
 * Use in Reel Recorder, StoryWriter, and other Saas apps.
 *
 * Features:
 * - Thumbnail generator with video frame OR webcam capture
 * - Add text and position on thumbnail
 * - Generate description from transcription (segments) or plain text
 * - Export to YouTube
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { getApiKey } from '@shared/apiKeys';
import {
  getYouTubeAccessToken,
  uploadVideoToYouTube,
  setYouTubeThumbnail,
} from './services/youtubeUpload';
import {
  generateYouTubeCaptionFromSegments,
  generateYouTubeDescriptionFromText,
} from './services/youtubeDescription';
import './YouTubeExportModule.css';

const FONT_OPTIONS = [
  { value: 'Oswald', label: 'Oswald' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'DM Sans', label: 'DM Sans' },
  { value: 'sans-serif', label: 'Sans-serif' },
  { value: 'serif', label: 'Serif' },
];

const MIN_FONT_PCT = 2;
const MAX_FONT_PCT = 50;

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const PUBLISH_MODES = [
  { value: 'now-public', label: 'Publish now (public)' },
  { value: 'now-unlisted', label: 'Publish now (unlisted)' },
  { value: 'draft', label: 'Save as draft (private)' },
  { value: 'schedule', label: 'Schedule' },
];

/**
 * @param {Object} props
 * @param {string} [props.videoUrl] - Video URL for frame selection (optional)
 * @param {Blob} [props.videoBlob] - Video blob for upload (optional; when missing, Upload to YouTube is hidden)
 * @param {string} [props.imageSource] - Base image URL for thumbnail (e.g. cover image from StoryWriter)
 * @param {string} props.aspectRatio - e.g. '9:16'
 * @param {number} props.width - Thumbnail width
 * @param {number} props.height - Thumbnail height
 * @param {Array<{start:number,text:string}>} [props.captionSegments] - For "Generate from transcription"
 * @param {string} [props.plainTextContent] - For "Generate from content" (e.g. story text)
 * @param {string} [props.openaiApiKey] - OpenAI key (or uses shared)
 * @param {string} props.youtubeTitle
 * @param {function} props.onYoutubeTitleChange
 * @param {string} props.youtubeCaption
 * @param {function} props.onYoutubeCaptionChange
 * @param {Blob|null} props.thumbnailBlob
 * @param {function} props.onThumbnailChange
 * @param {function} props.onClose
 * @param {string} [props.videoDeviceId]
 * @param {boolean} [props.flipVideo]
 * @param {boolean} [props.embedded]
 * @param {number} [props.initialSeekTime]
 * @param {Array} [props.initialTexts]
 * @param {string|null} [props.initialWebcamImageUrl]
 * @param {function} [props.onThumbnailStateChange]
 */
export default function YouTubeExportModule({
  videoUrl = '',
  videoBlob = null,
  imageSource = null,
  aspectRatio = '9:16',
  width: thumbWidth = 1080,
  height: thumbHeight = 1920,
  captionSegments = null,
  plainTextContent = '',
  openaiApiKey = '',
  youtubeTitle,
  onYoutubeTitleChange,
  youtubeCaption,
  onYoutubeCaptionChange,
  thumbnailBlob,
  onThumbnailChange,
  onClose,
  videoDeviceId,
  flipVideo = false,
  embedded = false,
  initialSeekTime = 0,
  initialTexts = [],
  initialWebcamImageUrl = null,
  onThumbnailStateChange,
}) {
  const videoRef = useRef(null);
  const webcamVideoRef = useRef(null);
  const webcamStreamRef = useRef(null);
  const containerRef = useRef(null);

  const [seekTime, setSeekTime] = useState(initialSeekTime);
  const [duration, setDuration] = useState(0);
  const [texts, setTexts] = useState(initialTexts);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [webcamImageUrl, setWebcamImageUrl] = useState(initialWebcamImageUrl ?? null);
  const [captionGenerating, setCaptionGenerating] = useState(false);
  const [captionError, setCaptionError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [resizeState, setResizeState] = useState(null);
  const [webcamLive, setWebcamLive] = useState(false);
  const [webcamError, setWebcamError] = useState(null);
  const [previewWidth, setPreviewWidth] = useState(0);
  const [previewScale, setPreviewScale] = useState(100);
  const [thumbnailBrightness, setThumbnailBrightness] = useState(100);
  const [thumbnailContrast, setThumbnailContrast] = useState(100);
  const [thumbnailSaturation, setThumbnailSaturation] = useState(100);
  const [youtubePublishMode, setYoutubePublishMode] = useState('draft');
  const [youtubeScheduleDatetime, setYoutubeScheduleDatetime] = useState('');

  const hasVideo = !!videoUrl?.trim();
  const hasImageSource = !!imageSource?.trim();
  const apiKey = openaiApiKey?.trim() || getApiKey('openai') || '';

  useEffect(() => {
    if (!hasVideo) return;
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => {
      setDuration(v.duration);
      setSeekTime(0);
    };
    v.addEventListener('loadedmetadata', onLoaded);
    if (v.duration && isFinite(v.duration)) onLoaded();
    return () => v.removeEventListener('loadedmetadata', onLoaded);
  }, [videoUrl, hasVideo]);

  useEffect(() => {
    if (!hasVideo) return;
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = seekTime;
  }, [seekTime, videoUrl, hasVideo]);

  useEffect(() => {
    const stream = webcamStreamRef.current;
    const v = webcamVideoRef.current;
    if (!stream || !v) return;
    v.srcObject = stream;
    v.play().catch(() => {});
    return () => { v.srcObject = null; };
  }, [webcamLive]);

  useEffect(() => {
    return () => {
      const stream = webcamStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        webcamStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === 'number') setPreviewWidth(w);
    });
    ro.observe(el);
    setPreviewWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    onThumbnailStateChange?.({ seekTime, texts, webcamImageUrl });
  }, [seekTime, texts, webcamImageUrl, onThumbnailStateChange]);

  const addText = useCallback(() => {
    const item = {
      id: generateId(),
      text: 'Your title',
      x: 0.5,
      y: 0.5,
      fontSizePercent: 5,
      fontFamily: 'Oswald',
    };
    setTexts((prev) => [...prev, item]);
    setSelectedTextId(item.id);
  }, []);

  const updateText = useCallback((id, patch) => {
    setTexts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const removeText = useCallback((id) => {
    setTexts((prev) => prev.filter((t) => t.id !== id));
    if (selectedTextId === id) setSelectedTextId(null);
  }, [selectedTextId]);

  const startWebcam = useCallback(async () => {
    setWebcamError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setWebcamError('Camera not supported. Use HTTPS and a modern browser.');
      return;
    }
    try {
      const constraints = videoDeviceId
        ? { deviceId: { ideal: videoDeviceId }, width: { ideal: thumbWidth }, height: { ideal: thumbHeight } }
        : { width: { ideal: thumbWidth }, height: { ideal: thumbHeight }, facingMode: 'user' };
      const stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      webcamStreamRef.current = stream;
      setWebcamImageUrl(null);
      setWebcamLive(true);
    } catch (e) {
      setWebcamError(e instanceof Error ? e.message : 'Could not access webcam');
    }
  }, [thumbWidth, thumbHeight, videoDeviceId]);

  const captureWebcamPhoto = useCallback(() => {
    const v = webcamVideoRef.current;
    const stream = webcamStreamRef.current;
    if (!v || !stream || v.readyState < 2) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (flipVideo) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
    if (flipVideo) ctx.setTransform(1, 0, 0, 1, 0, 0);
    setWebcamImageUrl(canvas.toDataURL('image/png'));
    setWebcamLive(false);
    stream.getTracks().forEach((t) => t.stop());
    webcamStreamRef.current = null;
  }, [flipVideo]);

  const clearWebcamPhoto = useCallback(() => {
    setWebcamImageUrl(null);
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((t) => t.stop());
      webcamStreamRef.current = null;
    }
    setWebcamLive(false);
    setWebcamError(null);
  }, []);

  const handlePointerDown = useCallback((e, id) => {
    if (e.target?.getAttribute?.('data-resize-handle') === 'true') return;
    e.preventDefault();
    const t = texts.find((x) => x.id === id);
    if (!t) return;
    setSelectedTextId(id);
    setDragState({ id, startX: e.clientX, startY: e.clientY, startItemX: t.x, startItemY: t.y });
    e.target?.setPointerCapture?.(e.pointerId);
  }, [texts]);

  const handleResizePointerDown = useCallback((e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const t = texts.find((x) => x.id === id);
    if (!t) return;
    setSelectedTextId(id);
    setResizeState({ id, startY: e.clientY, startFontSizePercent: t.fontSizePercent });
    containerRef.current?.setPointerCapture?.(e.pointerId);
  }, [texts]);

  const handlePointerMove = useCallback((e) => {
    if (resizeState) {
      const dy = e.clientY - resizeState.startY;
      const newPercent = Math.max(MIN_FONT_PCT, Math.min(MAX_FONT_PCT, resizeState.startFontSizePercent + dy * 0.08));
      updateText(resizeState.id, { fontSizePercent: newPercent });
      return;
    }
    if (!dragState) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = (e.clientX - dragState.startX) / rect.width;
    const dy = (e.clientY - dragState.startY) / rect.height;
    updateText(dragState.id, { x: Math.max(0, Math.min(1, dragState.startItemX + dx)), y: Math.max(0, Math.min(1, dragState.startItemY + dy)) });
  }, [dragState, resizeState, updateText]);

  const handlePointerUp = useCallback((e) => {
    setDragState(null);
    setResizeState(null);
    containerRef.current?.releasePointerCapture?.(e.pointerId);
    e.target?.releasePointerCapture?.(e.pointerId);
  }, []);

  const drawTextsOnCanvas = useCallback((ctx) => {
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (const t of texts) {
      if (!t.text?.trim()) continue;
      const fontSize = (thumbWidth * t.fontSizePercent) / 100;
      ctx.font = `bold ${fontSize}px "${t.fontFamily || 'Oswald'}", sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(2, fontSize / 30);
      const px = t.x * thumbWidth;
      const py = t.y * thumbHeight;
      ctx.strokeText(t.text, px, py);
      ctx.fillText(t.text, px, py);
    }
  }, [texts, thumbWidth, thumbHeight]);

  const thumbnailColorFilter =
    thumbnailBrightness !== 100 || thumbnailContrast !== 100 || thumbnailSaturation !== 100
      ? `brightness(${thumbnailBrightness}%) contrast(${thumbnailContrast}%) saturate(${thumbnailSaturation}%)`
      : 'none';

  const generateThumbnail = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = thumbWidth;
    canvas.height = thumbHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawAndExport = () => {
      if (thumbnailColorFilter !== 'none') ctx.filter = thumbnailColorFilter;
      drawTextsOnCanvas(ctx);
      ctx.filter = 'none';
      canvas.toBlob((blob) => blob && onThumbnailChange(blob, canvas.toDataURL('image/png')), 'image/png', 0.95);
    };

    if (webcamImageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (thumbnailColorFilter !== 'none') ctx.filter = thumbnailColorFilter;
        ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
        drawAndExport();
      };
      img.onerror = drawAndExport;
      img.src = webcamImageUrl;
      return;
    }

    if (imageSource) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (thumbnailColorFilter !== 'none') ctx.filter = thumbnailColorFilter;
        ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
        drawAndExport();
      };
      img.onerror = () => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, thumbWidth, thumbHeight);
        drawAndExport();
      };
      img.src = imageSource;
      return;
    }

    if (thumbnailColorFilter !== 'none') ctx.filter = thumbnailColorFilter;
    const video = videoRef.current;
    if (video && video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, thumbWidth, thumbHeight);
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, thumbWidth, thumbHeight);
    }
    drawAndExport();
  }, [texts, thumbWidth, thumbHeight, webcamImageUrl, imageSource, thumbnailColorFilter, drawTextsOnCanvas, onThumbnailChange]);

  const generateCaption = useCallback(async () => {
    setCaptionError(null);
    setCaptionGenerating(true);
    try {
      if (captionSegments?.length) {
        const text = await generateYouTubeCaptionFromSegments(captionSegments, apiKey);
        onYoutubeCaptionChange(text);
      } else if (plainTextContent?.trim()) {
        const text = await generateYouTubeDescriptionFromText(plainTextContent, apiKey);
        onYoutubeCaptionChange(text);
      } else {
        setCaptionError('Add transcription or content first to generate a description.');
      }
    } catch (e) {
      setCaptionError(e instanceof Error ? e.message : 'Failed to generate caption');
    } finally {
      setCaptionGenerating(false);
    }
  }, [captionSegments, plainTextContent, apiKey, onYoutubeCaptionChange]);

  const handleUploadToYouTube = useCallback(async () => {
    const clientId = getApiKey('googleClientId');
    if (!clientId?.trim()) {
      setUploadError('Add your Google Client ID in Settings to upload to YouTube.');
      return;
    }
    if (youtubePublishMode === 'schedule' && !youtubeScheduleDatetime.trim()) {
      setUploadError('Set a date and time for scheduled publish.');
      return;
    }
    if (!videoBlob) {
      setUploadError('No video to upload.');
      return;
    }
    const title = (youtubeTitle || '').trim() || 'My video';
    setUploadError(null);
    setUploadSuccess(null);
    setUploading(true);
    try {
      const token = await getYouTubeAccessToken(clientId.trim());
      const privacyStatus =
        youtubePublishMode === 'now-public' ? 'public'
        : youtubePublishMode === 'now-unlisted' ? 'unlisted'
        : 'private';
      const publishAt = youtubePublishMode === 'schedule' && youtubeScheduleDatetime.trim()
        ? new Date(youtubeScheduleDatetime.trim()).toISOString()
        : undefined;
      const videoId = await uploadVideoToYouTube(token, videoBlob, {
        title,
        description: (youtubeCaption || '').trim(),
        privacyStatus,
        publishAt,
      });
      if (thumbnailBlob) {
        await setYouTubeThumbnail(token, videoId, thumbnailBlob);
      }
      const msg = publishAt
        ? `Scheduled! Video ID: ${videoId}. It will publish at ${new Date(publishAt).toLocaleString()}.`
        : youtubePublishMode === 'draft'
          ? `Saved as draft. Video ID: ${videoId}. Check YouTube Studio to publish.`
          : `Uploaded! Video ID: ${videoId}. Check your YouTube Studio.`;
      setUploadSuccess(msg);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [videoBlob, youtubeTitle, youtubeCaption, thumbnailBlob, youtubePublishMode, youtubeScheduleDatetime]);

  const selectedText = texts.find((t) => t.id === selectedTextId);
  const canGenerateCaption = (captionSegments?.length || plainTextContent?.trim()) && apiKey;
  const hasThumbnailSource = hasVideo || hasImageSource || webcamImageUrl || webcamLive;

  const content = (
    <>
      <div className="ytex-header">
        <h2 className="ytex-title">Export to YouTube</h2>
        <button type="button" className="ytex-closeBtn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="ytex-body">
        <div className={embedded ? 'ytex-bodyThreeColEmbed' : 'ytex-bodyThreeCol'}>
          <div className="ytex-bodyColEdit">
            <section className="ytex-thumbSection">
              <h3 className="ytex-sectionTitle">Thumbnail</h3>
              <p className="ytex-hint">
                Add text and position it. Use webcam or {hasVideo ? 'video frame' : 'image'} as background. {aspectRatio} — {thumbWidth}×{thumbHeight}.
              </p>
              {webcamError && <p className="ytex-error">{webcamError}</p>}
              {!webcamLive && !webcamImageUrl && (
                <>
                  {hasVideo && (
                    <>
                      <label className="ytex-label">Frame time</label>
                      <input
                        type="range"
                        className="ytex-slider"
                        min={0}
                        max={duration || 1}
                        step={0.1}
                        value={seekTime}
                        onChange={(e) => setSeekTime(Number(e.target.value))}
                      />
                      <span className="ytex-timeValue">{seekTime.toFixed(1)}s</span>
                    </>
                  )}
                  {!hasThumbnailSource && (
                    <p className="ytex-hint">Use webcam or add text to create a thumbnail.</p>
                  )}
                  <button type="button" className="ytex-btn" onClick={startWebcam}>
                    Take photo with webcam
                  </button>
                </>
              )}
              {webcamLive && (
                <>
                  <button type="button" className="ytex-btnPrimary" onClick={captureWebcamPhoto}>
                    Capture photo
                  </button>
                  <button type="button" className="ytex-btn" onClick={clearWebcamPhoto}>
                    Cancel
                  </button>
                </>
              )}
              {webcamImageUrl && (hasVideo || imageSource) && (
                <button type="button" className="ytex-btn" onClick={clearWebcamPhoto}>
                  Use {hasVideo ? 'video frame' : 'image'} instead
                </button>
              )}
              <div className="ytex-thumbColorRow">
                <label className="ytex-label">Thumbnail color</label>
              </div>
              <div className="ytex-sliderRow">
                <label className="ytex-label">Brightness</label>
                <input type="range" className="ytex-slider" min={0} max={200} value={thumbnailBrightness} onChange={(e) => setThumbnailBrightness(Number(e.target.value))} />
                <span className="ytex-sliderValue">{thumbnailBrightness}%</span>
              </div>
              <div className="ytex-sliderRow">
                <label className="ytex-label">Contrast</label>
                <input type="range" className="ytex-slider" min={0} max={200} value={thumbnailContrast} onChange={(e) => setThumbnailContrast(Number(e.target.value))} />
                <span className="ytex-sliderValue">{thumbnailContrast}%</span>
              </div>
              <div className="ytex-sliderRow">
                <label className="ytex-label">Saturation</label>
                <input type="range" className="ytex-slider" min={0} max={200} value={thumbnailSaturation} onChange={(e) => setThumbnailSaturation(Number(e.target.value))} />
                <span className="ytex-sliderValue">{thumbnailSaturation}%</span>
              </div>
              <button type="button" className="ytex-btn" onClick={addText}>
                Add text
              </button>
              {selectedText && (
                <div className="ytex-textEdit">
                  <label className="ytex-label">Selected text</label>
                  <input type="text" className="ytex-input" value={selectedText.text} onChange={(e) => updateText(selectedText.id, { text: e.target.value })} placeholder="Text" />
                  <label className="ytex-label">Font</label>
                  <select className="ytex-select" value={selectedText.fontFamily ?? 'Oswald'} onChange={(e) => updateText(selectedText.id, { fontFamily: e.target.value })}>
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                  <label className="ytex-label">Size %</label>
                  <input type="range" className="ytex-slider" min={MIN_FONT_PCT} max={MAX_FONT_PCT} value={selectedText.fontSizePercent} onChange={(e) => updateText(selectedText.id, { fontSizePercent: Number(e.target.value) })} />
                  <span className="ytex-sliderValue">{selectedText.fontSizePercent?.toFixed(1) ?? 5}%</span>
                  <button type="button" className="ytex-removeTextBtn" onClick={() => removeText(selectedText.id)}>Remove text</button>
                </div>
              )}
              <button type="button" className="ytex-btnPrimary" onClick={generateThumbnail}>
                Generate thumbnail
              </button>
              {thumbnailBlob && <p className="ytex-doneHint">Thumbnail saved. It will be used when you upload to YouTube.</p>}
            </section>
          </div>

          <div className="ytex-bodyColPreview">
            <section className="ytex-previewSection">
              <h3 className="ytex-sectionTitle">Preview</h3>
              <div className="ytex-previewScaleRow">
                <label className="ytex-label">Scale</label>
                <input type="range" className="ytex-slider" min={25} max={200} step={5} value={previewScale} onChange={(e) => setPreviewScale(Number(e.target.value))} />
                <span className="ytex-sliderValue">{previewScale}%</span>
              </div>
              <div className="ytex-previewScaleContainer">
                <div
                  ref={containerRef}
                  className="ytex-previewWrap"
                  style={(() => {
                    const maxW = 400, maxH = 520, ratio = thumbWidth / thumbHeight;
                    let baseW = thumbHeight >= thumbWidth ? maxH * ratio : maxW;
                    let baseH = thumbHeight >= thumbWidth ? maxH : maxW / ratio;
                    if (baseW > maxW) { baseW = maxW; baseH = maxW / ratio; }
                    if (baseH > maxH) { baseH = maxH; baseW = maxH * ratio; }
                    const scale = previewScale / 100;
                    return { width: baseW * scale, height: baseH * scale, maxWidth: '100%' };
                  })()}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                >
                  <div
                    className="ytex-videoBg"
                    style={(thumbnailBrightness !== 100 || thumbnailContrast !== 100 || thumbnailSaturation !== 100) ? { filter: `brightness(${thumbnailBrightness}%) contrast(${thumbnailContrast}%) saturate(${thumbnailSaturation}%)` } : {}}
                  >
                    {webcamImageUrl ? (
                      <img src={webcamImageUrl} alt="Thumbnail" className="ytex-videoBgImg" />
                    ) : webcamLive ? (
                      <video ref={webcamVideoRef} muted playsInline autoPlay className="ytex-videoBgImg" style={flipVideo ? { transform: 'scaleX(-1)' } : undefined} />
                    ) : hasVideo ? (
                      <video ref={videoRef} src={videoUrl} muted playsInline preload="metadata" className="ytex-videoBgImg" />
                    ) : imageSource ? (
                      <img src={imageSource} alt="Thumbnail" className="ytex-videoBgImg" crossOrigin="anonymous" />
                    ) : (
                      <div className="ytex-videoBgImg" style={{ background: '#000', width: '100%', height: '100%' }} aria-hidden />
                    )}
                  </div>
                  {texts.map((t) => {
                    const fontSizePx = previewWidth > 0 ? (previewWidth * (t.fontSizePercent ?? 5)) / 100 : 24;
                    const isSelected = selectedTextId === t.id;
                    return (
                      <div
                        key={t.id}
                        className={`ytex-thumbText ${isSelected ? 'ytex-thumbTextSelected' : ''}`}
                        style={{
                          left: `${t.x * 100}%`,
                          top: `${t.y * 100}%`,
                          transform: 'translate(-50%, -50%)',
                          fontSize: `${fontSizePx}px`,
                          fontFamily: `"${t.fontFamily || 'Oswald'}", sans-serif`,
                        }}
                        onPointerDown={(e) => handlePointerDown(e, t.id)}
                      >
                        <span className="ytex-thumbTextContent">{t.text || 'Text'}</span>
                        {isSelected && (
                          <span className="ytex-resizeHandle" data-resize-handle="true" onPointerDown={(e) => handleResizePointerDown(e, t.id)} title="Drag to resize" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          <div className="ytex-bodyColCaptions">
            <section className="ytex-captionSection">
              <h3 className="ytex-sectionTitle">Captions & description</h3>
              <p className="ytex-hint">Video title and description for YouTube.</p>
              <label className="ytex-label">Video title</label>
              <input type="text" className="ytex-input" value={youtubeTitle || ''} onChange={(e) => onYoutubeTitleChange(e.target.value)} placeholder="Video title for YouTube" />
              {canGenerateCaption && (
                <button type="button" className="ytex-captionGenBtn" onClick={generateCaption} disabled={captionGenerating}>
                  {captionGenerating ? 'Generating…' : '✨ Generate from content'}
                </button>
              )}
              {captionError && <p className="ytex-error">{captionError}</p>}
              <label className="ytex-label">Description</label>
              <textarea className="ytex-textarea" value={youtubeCaption || ''} onChange={(e) => onYoutubeCaptionChange(e.target.value)} placeholder="Video description for YouTube…" rows={10} />
            </section>
            {videoBlob && (
              <section className="ytex-uploadSection">
                <h3 className="ytex-sectionTitle">Upload to YouTube</h3>
                <p className="ytex-hint">Add your Google Client ID in Settings first.</p>
                <label className="ytex-label">Publish</label>
                <select className="ytex-select" value={youtubePublishMode} onChange={(e) => setYoutubePublishMode(e.target.value)}>
                  {PUBLISH_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                {youtubePublishMode === 'schedule' && (
                  <>
                    <label className="ytex-label">Publish at</label>
                    <input type="datetime-local" className="ytex-input" value={youtubeScheduleDatetime} onChange={(e) => setYoutubeScheduleDatetime(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
                  </>
                )}
                {uploadError && <p className="ytex-error">{uploadError}</p>}
                {uploadSuccess && <p className="ytex-success">{uploadSuccess}</p>}
                <button type="button" className="ytex-btnPrimary" onClick={handleUploadToYouTube} disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Upload to YouTube'}
                </button>
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="ytex-embedded" aria-label="Export to YouTube">
        <div className="ytex-panel">{content}</div>
      </div>
    );
  }

  return (
    <div className="ytex-overlay" role="dialog" aria-modal="true" aria-label="Export to YouTube">
      <div className="ytex-panel">{content}</div>
    </div>
  );
}

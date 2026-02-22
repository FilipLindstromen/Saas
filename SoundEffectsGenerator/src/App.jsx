import { useState, useRef, useEffect } from 'react';
import { transcribe, analyzeImportant, generateEffect } from './services/api';
import SettingsModal from './components/SettingsModal';
import AppTopBar from '@shared/AppTopBar/AppTopBar';
import { loadAppState, saveAppState } from './utils/persistence';
import JSZip from 'jszip';
import './App.css';

function App() {
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [overallFeel, setOverallFeel] = useState('');
  const [userImportantFocus, setUserImportantFocus] = useState('');
  const [selectedSegmentIndices, setSelectedSegmentIndices] = useState([]);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importantMoments, setImportantMoments] = useState([]);
  const [momentPrompts, setMomentPrompts] = useState([]);
  const [momentDurations, setMomentDurations] = useState([]);
  const [soundDirection, setSoundDirection] = useState('');
  const [effectDurationMin, setEffectDurationMin] = useState(2);
  const [effectDurationMax, setEffectDurationMax] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [generatingAmbient, setGeneratingAmbient] = useState(false);
  const [ambientSegments, setAmbientSegments] = useState([]); // [{ url, durationSeconds }, ...] – one per important moment, 60s total
  const [isPlayingAmbient, setIsPlayingAmbient] = useState(false);
  const [effects, setEffects] = useState([]);
  const [selectedEffectIndices, setSelectedEffectIndices] = useState([]);
  const [error, setError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasRestored, setHasRestored] = useState(false);
  const [backendTipDismissed, setBackendTipDismissed] = useState(() => {
    try { return localStorage.getItem('soundeffects_backend_tip_dismissed') === '1'; } catch { return false; }
  });
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    try {
      const w = parseInt(localStorage.getItem('soundeffects_leftPanelWidth'), 10);
      return Number.isFinite(w) && w >= 260 && w <= 800 ? w : 380;
    } catch { return 380; }
  });
  const [transcriptPanelWidth, setTranscriptPanelWidth] = useState(() => {
    try {
      const w = parseInt(localStorage.getItem('soundeffects_transcriptPanelWidth'), 10);
      return Number.isFinite(w) && w >= 260 && w <= 800 ? w : 420;
    } catch { return 420; }
  });
  const [activeResizer, setActiveResizer] = useState(null);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [isPlayingWithVoiceover, setIsPlayingWithVoiceover] = useState(false);
  const [soundEffectsVolume, setSoundEffectsVolume] = useState(() => {
    try {
      const v = parseFloat(localStorage.getItem('soundeffects_sfx_volume'));
      return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 1;
    } catch {
      return 1;
    }
  });
  const resizeStartRef = useRef({ x: 0, left: 380, transcript: 420, lastLeft: 380, lastTranscript: 420 });
  const playAllRef = useRef({ audio: null });
  const voiceoverPlaybackRef = useRef({ mainAudio: null, effectAudios: [], triggered: new Set() });
  const ambientAudioRef = useRef(null);
  const ambientSegmentsRef = useRef([]);
  const ambientSegmentIndexRef = useRef(0);
  const fileInputRef = useRef(null);
  const mainRef = useRef(null);

  const dismissBackendTip = () => {
    setBackendTipDismissed(true);
    try { localStorage.setItem('soundeffects_backend_tip_dismissed', '1'); } catch (_) {}
  };

  const MIN_PANEL = 260;
  const MAX_PANEL = 800;

  const handleResizeStart = (which) => (e) => {
    e.preventDefault();
    setActiveResizer(which);
    resizeStartRef.current = {
      x: e.clientX,
      left: leftPanelWidth,
      transcript: transcriptPanelWidth,
      lastLeft: leftPanelWidth,
      lastTranscript: transcriptPanelWidth,
    };
  };

  useEffect(() => {
    if (!activeResizer) return;
    const container = mainRef.current;
    const onMove = (e) => {
      const dx = e.clientX - resizeStartRef.current.x;
      const total = container ? container.clientWidth : 0;
      const minRight = 300;
      const resizersWidth = 20;
      const startLeft = resizeStartRef.current.left;
      const startTranscript = resizeStartRef.current.transcript;
      const maxLeft = total ? total - startTranscript - resizersWidth - minRight : MAX_PANEL;
      const maxTranscript = total ? total - startLeft - resizersWidth - minRight : MAX_PANEL;
      if (activeResizer === 'left') {
        const next = Math.min(MAX_PANEL, Math.max(MIN_PANEL, startLeft + dx));
        const clamped = total ? Math.min(next, maxLeft) : next;
        resizeStartRef.current.lastLeft = clamped;
        setLeftPanelWidth(clamped);
      } else {
        const next = Math.min(MAX_PANEL, Math.max(MIN_PANEL, startTranscript + dx));
        const clamped = total ? Math.min(next, maxTranscript) : next;
        resizeStartRef.current.lastTranscript = clamped;
        setTranscriptPanelWidth(clamped);
      }
    };
    const onUp = () => {
      setActiveResizer(null);
      try {
        localStorage.setItem('soundeffects_leftPanelWidth', String(resizeStartRef.current.lastLeft));
        localStorage.setItem('soundeffects_transcriptPanelWidth', String(resizeStartRef.current.lastTranscript));
      } catch (_) {}
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [activeResizer]);

  useEffect(() => {
    try {
      localStorage.setItem('soundeffects_sfx_volume', String(soundEffectsVolume));
    } catch (_) {}
  }, [soundEffectsVolume]);

  // Restore state from browser on mount
  useEffect(() => {
    loadAppState()
      .then((loaded) => {
        setAudioFile(loaded.audioFile ?? null);
        setAudioUrl(loaded.audioUrl ?? null);
        setOverallFeel(loaded.overallFeel ?? '');
        setUserImportantFocus(loaded.userImportantFocus ?? '');
        setSelectedSegmentIndices(Array.isArray(loaded.selectedSegmentIndices) ? loaded.selectedSegmentIndices : []);
        setTranscript(loaded.transcript ?? null);
        const loadedMoments = loaded.importantMoments ?? [];
        setImportantMoments(loadedMoments);
        const loadedPrompts = Array.isArray(loaded.momentPrompts) ? loaded.momentPrompts : [];
        setMomentPrompts(
          loadedPrompts.length === loadedMoments.length
            ? loadedPrompts
            : loadedMoments.map((m) => m.elevenLabsPrompt || (m.effectSuggestion ? `${m.effectSuggestion} sound` : '') || '')
        );
        const loadedDurations = Array.isArray(loaded.momentDurations) ? loaded.momentDurations : [];
        setMomentDurations(
          loadedDurations.length === loadedMoments.length
            ? loadedDurations
            : loadedMoments.map(() => '')
        );
        setSoundDirection(loaded.soundDirection ?? '');
        setEffectDurationMin(Number(loaded.effectDurationMin) || 2);
        setEffectDurationMax(Number(loaded.effectDurationMax) || 4);
        setEffects(loaded.effects ?? []);
        setHasRestored(true);
      })
      .catch(() => setHasRestored(true));
  }, []);

  // Persist state whenever it changes (after first restore)
  useEffect(() => {
    if (!hasRestored) return;
    saveAppState({
      audioFile,
      transcript,
      importantMoments,
      momentPrompts,
      momentDurations,
      soundDirection,
      overallFeel,
      userImportantFocus,
      selectedSegmentIndices,
      effectDurationMin,
      effectDurationMax,
      effects,
    }).catch(() => {});
  }, [
    hasRestored,
    audioFile,
    transcript,
    importantMoments,
    momentPrompts,
    momentDurations,
    soundDirection,
    overallFeel,
    userImportantFocus,
    selectedSegmentIndices,
    effectDurationMin,
    effectDurationMax,
    effects,
  ]);

  const handleFile = (e) => {
    const file = e.target?.files?.[0];
    setError(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (!file) {
      setAudioFile(null);
      setAudioUrl(null);
    setTranscript(null);
    setSelectedSegmentIndices([]);
    setImportantMoments([]);
    setEffects([]);
    setSelectedEffectIndices([]);
    setAmbientSegments((prev) => {
      prev.forEach((s) => URL.revokeObjectURL(s.url));
      return [];
    });
    setSoundDirection('');
    return;
  }
  if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file (MP3, WAV, etc.)');
      return;
    }
    setAudioFile(file);
    setAudioUrl(URL.createObjectURL(file));
    setTranscript(null);
    setSelectedSegmentIndices([]);
    setImportantMoments([]);
    setEffects([]);
    setSelectedEffectIndices([]);
    setAmbientSegments((prev) => {
      prev.forEach((s) => URL.revokeObjectURL(s.url));
      return [];
    });
    setSoundDirection('');
  };

  const toggleSegmentSelection = (index) => {
    setSelectedSegmentIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)
    );
  };

  const toggleEffectSelection = (index) => {
    setSelectedEffectIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)
    );
  };

  const handleTranscribe = async () => {
    if (!audioFile) {
      setError('Select an audio file first');
      return;
    }
    setError(null);
    setTranscribing(true);
    try {
      const result = await transcribe(audioFile);
      setTranscript(result);
      setSelectedSegmentIndices([]);
    } catch (err) {
      setError(err.message || 'Transcription failed');
    } finally {
      setTranscribing(false);
    }
  };

  const handleAnalyzeImportant = async () => {
    const hasSegments = transcript?.segments?.length > 0;
    const hasText = transcript?.text?.trim?.();
    if (!transcript || (!hasSegments && !hasText)) {
      setError('Transcribe the audio first');
      return;
    }
    setError(null);
    setAnalyzing(true);
    try {
      let selectedSegments = [];
      const segments = transcript.segments || [];
      if (hasSegments) {
        const segCount = segments.length;
        selectedSegments = selectedSegmentIndices
          .filter((i) => Number.isInteger(i) && i >= 0 && i < segCount)
          .map((i) => {
            const s = segments[i];
            return s ? { start: s.start, end: s.end, text: s.text } : null;
          })
          .filter(Boolean);
      } else {
        const lines = (transcript.text || '').split(/\n+/).filter((l) => l.trim());
        const lineCount = lines.length;
        selectedSegments = selectedSegmentIndices
          .filter((i) => Number.isInteger(i) && i >= 0 && i < lineCount)
          .map((i) => ({ start: 0, end: 0, text: lines[i].trim() }));
      }
      const { importantMoments: moments, soundDirection: direction } = await analyzeImportant(
        segments,
        transcript.text,
        overallFeel.trim() || undefined,
        userImportantFocus.trim() || undefined,
        selectedSegments.length ? selectedSegments : undefined
      );
      let momentsList = Array.isArray(moments) ? moments : [];
      if (selectedSegments.length > 0 && momentsList.length < selectedSegments.length) {
        momentsList = selectedSegments.map((seg, i) => {
          const m = momentsList[i] || {};
          return {
            start: seg.start,
            end: seg.end,
            text: seg.text,
            reason: m.reason || 'Selected for sound effect',
            effectSuggestion: m.effectSuggestion || 'sfx',
            elevenLabsPrompt: m.elevenLabsPrompt || 'Short sound effect',
          };
        });
      }
      setImportantMoments(momentsList);
      setMomentPrompts(
        momentsList.map((m) =>
          m.elevenLabsPrompt || (m.effectSuggestion ? `${m.effectSuggestion} sound` : '') || 'Short sound effect'
        )
      );
      setMomentDurations(momentsList.map(() => ''));
      setSoundDirection(direction || '');
    } catch (err) {
      setError(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateEffects = async () => {
    if (!importantMoments.length) {
      setError('Mark important parts first (Analyze important)');
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const list = [];
      const feel = overallFeel.trim() || undefined;
      const minD = Math.max(0.5, Math.min(30, Number(effectDurationMin) || 2));
      const maxD = Math.max(0.5, Math.min(30, Number(effectDurationMax) || 4));
      const lo = Math.min(minD, maxD);
      const hi = Math.max(minD, maxD);
      for (let i = 0; i < importantMoments.length; i++) {
        const m = importantMoments[i];
        const editedPrompt = momentPrompts[i]?.trim();
        const rawPrompt =
          editedPrompt ||
          m.elevenLabsPrompt ||
          (m.effectSuggestion ? `${m.effectSuggestion} sound, short` : `short sound effect for "${m.text || 'moment'}"`);
        const prompt = rawPrompt.trim() || 'Short ambient sound effect';
        const overrideSec = parseFloat(momentDurations[i]);
        const duration = Number.isFinite(overrideSec)
          ? Math.max(0.5, Math.min(30, overrideSec))
          : lo + Math.random() * (hi - lo);
        const blob = await generateEffect(prompt, feel, duration);
        const url = URL.createObjectURL(blob);
        const ext = blob.type?.includes('mp3') ? 'mp3' : 'wav';
        list.push({
          ...m,
          effectType: m.effectSuggestion || m.effectType || 'sfx',
          elevenLabsPrompt: prompt,
          customPrompt: editedPrompt || undefined,
          effectUrl: url,
          effectBlob: blob,
          effectExt: ext,
          index: i + 1,
          durationSeconds: duration,
        });
      }
      setEffects(list);
      setSelectedEffectIndices([]);
    } catch (err) {
      setError(err.message || 'Effect generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateEffects = async () => {
    const indices = [...selectedEffectIndices].filter((i) => i >= 0 && i < effects.length).sort((a, b) => a - b);
    if (indices.length === 0) return;
    setError(null);
    setGenerating(true);
    try {
      const feel = overallFeel.trim() || undefined;
      const minD = Math.max(0.5, Math.min(30, Number(effectDurationMin) || 2));
      const maxD = Math.max(0.5, Math.min(30, Number(effectDurationMax) || 4));
      const lo = Math.min(minD, maxD);
      const hi = Math.max(minD, maxD);
      const next = [...effects];
      for (const i of indices) {
        const e = effects[i];
        if (e.effectUrl) URL.revokeObjectURL(e.effectUrl);
        const editedPrompt = momentPrompts[i]?.trim();
        const rawPrompt =
          editedPrompt ||
          e.elevenLabsPrompt ||
          (e.effectSuggestion ? `${e.effectSuggestion} sound, short` : `short sound effect for "${e.text || 'moment'}"`);
        const prompt = rawPrompt.trim() || 'Short ambient sound effect';
        const overrideSec = parseFloat(momentDurations[i]);
        const duration = Number.isFinite(overrideSec)
          ? Math.max(0.5, Math.min(30, overrideSec))
          : lo + Math.random() * (hi - lo);
        const blob = await generateEffect(prompt, feel, duration);
        const url = URL.createObjectURL(blob);
        const ext = blob.type?.includes('mp3') ? 'mp3' : 'wav';
        next[i] = {
          ...e,
          effectType: e.effectSuggestion || e.effectType || 'sfx',
          elevenLabsPrompt: prompt,
          customPrompt: editedPrompt || undefined,
          effectUrl: url,
          effectBlob: blob,
          effectExt: ext,
          index: i + 1,
          durationSeconds: duration,
        };
      }
      setEffects(next);
    } catch (err) {
      setError(err.message || 'Effect regeneration failed');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    ambientSegmentsRef.current = ambientSegments;
  }, [ambientSegments]);
  useEffect(() => {
    return () => {
      ambientSegmentsRef.current.forEach((s) => URL.revokeObjectURL(s.url));
      ambientSegmentsRef.current = [];
    };
  }, []);

  const handlePlayAmbient = () => {
    const el = ambientAudioRef.current;
    if (!el) return;
    if (isPlayingAmbient) {
      el.pause();
      return;
    }
    const segs = ambientSegmentsRef.current;
    if (segs.length === 0) return;
    ambientSegmentIndexRef.current = 0;
    el.src = segs[0].url;
    el.currentTime = 0;
    el.play().catch(() => setIsPlayingAmbient(false));
  };

  const handlePlayWithVoiceover = () => {
    if (isPlayingWithVoiceover) {
      const { mainAudio, effectAudios } = voiceoverPlaybackRef.current;
      mainAudio?.pause();
      effectAudios.forEach((a) => a.pause());
      voiceoverPlaybackRef.current = { mainAudio: null, effectAudios: [], triggered: new Set() };
      setIsPlayingWithVoiceover(false);
      return;
    }
    if (!audioUrl || !effects.length) return;
    const startTime =
      selectedEffectIndices.length > 0
        ? (() => {
            const idx = Math.min(...selectedEffectIndices.filter((i) => i >= 0 && i < effects.length));
            return Number(effects[idx]?.start) || 0;
          })()
        : 0;

    const mainAudio = new Audio(audioUrl);
    const effectAudios = [];
    const triggered = new Set();
    voiceoverPlaybackRef.current = { mainAudio, effectAudios, triggered };

    const onTimeUpdate = () => {
      const t = mainAudio.currentTime;
      effects.forEach((e, i) => {
        if (triggered.has(i)) return;
        if (t >= Number(e.start)) {
          triggered.add(i);
          if (e.effectUrl) {
            const a = new Audio(e.effectUrl);
            a.volume = soundEffectsVolume;
            effectAudios.push(a);
            a.play().catch(() => {});
          }
        }
      });
    };

    mainAudio.addEventListener('timeupdate', onTimeUpdate);
    mainAudio.addEventListener('ended', () => {
      mainAudio.removeEventListener('timeupdate', onTimeUpdate);
      effectAudios.forEach((a) => a.pause());
      voiceoverPlaybackRef.current = { mainAudio: null, effectAudios: [], triggered: new Set() };
      setIsPlayingWithVoiceover(false);
    });

    mainAudio.currentTime = startTime;
    mainAudio.play().catch((err) => {
      voiceoverPlaybackRef.current = { mainAudio: null, effectAudios: [], triggered: new Set() };
      setIsPlayingWithVoiceover(false);
      setError(err.message || 'Could not play voice-over');
    });
    setIsPlayingWithVoiceover(true);
  };

  const handlePlayAllEffects = () => {
    if (isPlayingAll) {
      playAllRef.current.audio?.pause();
      playAllRef.current.audio = null;
      setIsPlayingAll(false);
      return;
    }
    if (!effects.length) return;
    // Start from first effect, or from first selected effect; then play that one and every following in order
    const startIndex =
      selectedEffectIndices.length > 0
        ? Math.min(...selectedEffectIndices.filter((i) => i >= 0 && i < effects.length), effects.length - 1)
        : 0;
    const indices = effects.map((_, i) => i).slice(startIndex);
    if (indices.length === 0) return;
    let index = 0;
    const playNext = () => {
      if (index >= indices.length) {
        setIsPlayingAll(false);
        playAllRef.current.audio = null;
        return;
      }
      const effect = effects[indices[index]];
      index += 1;
      if (!effect?.effectUrl) {
        playNext();
        return;
      }
      const audio = new Audio(effect.effectUrl);
      audio.volume = soundEffectsVolume;
      playAllRef.current.audio = audio;
      audio.onended = playNext;
      audio.onerror = playNext;
      audio.play().catch(playNext);
    };
    setIsPlayingAll(true);
    playNext();
  };

  const handleGenerateAmbient = async () => {
    if (!importantMoments.length) return;
    setError(null);
    setGeneratingAmbient(true);
    setAmbientSegments((prev) => {
      prev.forEach((s) => URL.revokeObjectURL(s.url));
      return [];
    });
    try {
      const totalTargetSeconds = 60;
      const moments = importantMoments;
      const totalSpan = moments.reduce((sum, m) => sum + Math.max(0, Number(m.end) - Number(m.start)), 0);
      const rawDurations = totalSpan > 0
        ? moments.map((m) => (totalTargetSeconds * Math.max(0, Number(m.end) - Number(m.start))) / totalSpan)
        : moments.map(() => totalTargetSeconds / moments.length);
      const clamped = rawDurations.map((d) => Math.min(30, Math.max(5, d)));
      const scale = totalTargetSeconds / clamped.reduce((a, b) => a + b, 0);
      const segmentDurations = clamped.map((d) => Math.min(30, Math.max(5, Math.round(d * scale * 10) / 10)));
      const feel = overallFeel.trim() || undefined;
      const list = [];
      for (let i = 0; i < moments.length; i++) {
        const m = moments[i];
        const words = (m.text || '').toString().trim().slice(0, 120);
        const theme = (m.effectSuggestion || m.elevenLabsPrompt || m.reason || '').toString().trim().slice(0, 80);
        const prompt = words
          ? `Ambient background music for this moment: "${words}". ${theme ? `Mood: ${theme}. ` : ''}Smooth, atmospheric, no sudden changes, continuous, suitable for voice-over.`
          : `Ambient background music, mood: ${theme || 'calm, atmospheric'}. Smooth, continuous, suitable for voice-over.`;
        let duration = segmentDurations[i] ?? Math.min(30, totalTargetSeconds / moments.length);
        if (moments.length === 1) {
          duration = 30;
        }
        const blob = await generateEffect(prompt, feel, duration);
        list.push({ url: URL.createObjectURL(blob), durationSeconds: duration });
      }
      if (moments.length === 1) {
        const m = moments[0];
        const words = (m.text || '').toString().trim().slice(0, 120);
        const theme = (m.effectSuggestion || m.elevenLabsPrompt || m.reason || '').toString().trim().slice(0, 80);
        const prompt = words
          ? `Ambient background music for this moment: "${words}". ${theme ? `Mood: ${theme}. ` : ''}Smooth, atmospheric, no sudden changes, continuous, suitable for voice-over.`
          : `Ambient background music, mood: ${theme || 'calm, atmospheric'}. Smooth, continuous, suitable for voice-over.`;
        const blob = await generateEffect(prompt, feel, 30);
        list.push({ url: URL.createObjectURL(blob), durationSeconds: 30 });
      }
      setAmbientSegments(list);
    } catch (err) {
      setError(err.message || 'Ambient generation failed');
    } finally {
      setGeneratingAmbient(false);
    }
  };

  const exportCueSheet = () => {
    if (!effects.length) return;
    const cueSheet = {
      voiceoverFile: audioFile?.name || 'voiceover',
      soundDirection: soundDirection || undefined,
      overallFeel: overallFeel.trim() || undefined,
      cues: effects.map((e) => ({
        startTime: e.start,
        endTime: e.end,
        text: e.text,
        reason: e.reason,
        effectType: e.effectType,
        elevenLabsPrompt: e.elevenLabsPrompt,
        effectFile: `effect_${e.index}_${(e.effectType || 'sfx').replace(/\s+/g, '_')}.${e.effectExt || 'mp3'}`,
      })),
    };
    const blob = new Blob([JSON.stringify(cueSheet, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sound-effects-cue-sheet.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportFull = async () => {
    if (!effects.length) return;
    const zip = new JSZip();
    const cueSheet = {
      voiceoverFile: audioFile?.name || 'voiceover',
      soundDirection: soundDirection || undefined,
      overallFeel: overallFeel.trim() || undefined,
      cues: [],
    };
    for (let i = 0; i < effects.length; i++) {
      const e = effects[i];
      const name = `effect_${e.index}_${(e.effectType || 'sfx').replace(/\s+/g, '_')}.${e.effectExt || 'mp3'}`;
      const blob = e.effectBlob || (await fetch(e.effectUrl).then((r) => r.blob()));
      zip.file(name, blob);
      cueSheet.cues.push({
        startTime: e.start,
        endTime: e.end,
        text: e.text,
        reason: e.reason,
        effectType: e.effectType,
        elevenLabsPrompt: e.elevenLabsPrompt,
        effectFile: name,
      });
    }
    zip.file('cue-sheet.json', JSON.stringify(cueSheet, null, 2));
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sound-effects-export.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const [projects] = useState([{ id: 'default', name: 'Untitled' }]);
  const [tabs, setTabs] = useState([{ id: '1', name: 'Project 1' }]);
  const [activeTabId, setActiveTabId] = useState('1');

  return (
    <div className="app">
      <AppTopBar
        logo={
          <div className="header-content">
            <h1>Sound effects from voice-over</h1>
            <p>Upload audio → Transcribe (OpenAI) → Mark important parts → Generate effects (ElevenLabs) → Export</p>
            <p className="services-note">Transcription: OpenAI only · Sound effects: ElevenLabs only</p>
          </div>
        }
        showProject={true}
        projectProps={{
          projects,
          currentProjectId: 'default',
          currentProjectName: 'Untitled',
        }}
        showTabs={true}
        tabProps={{
          tabs,
          currentTabId: activeTabId,
          onSwitchTab: setActiveTabId,
          onAddTab: () => {
            const id = 't_' + Date.now();
            setTabs((prev) => [...prev, { id, name: 'Project ' + (prev.length + 1) }]);
            setActiveTabId(id);
          },
          onRenameTab: (tabId, name) => {
            setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, name } : t)));
          },
          onDeleteTab: (tabId) => {
            if (tabs.length <= 1) return;
            const nextTabs = tabs.filter((t) => t.id !== tabId);
            const nextActive = activeTabId === tabId ? (nextTabs[0]?.id ?? '1') : activeTabId;
            setTabs(nextTabs);
            setActiveTabId(nextActive);
          },
          defaultTabName: 'Project',
          addTitle: 'Add project',
        }}
        actions={
          <div className="header-actions">
            {ambientSegments.length > 0 && (
              <button
                type="button"
                className="play-all-btn play-ambient-btn"
                onClick={handlePlayAmbient}
                aria-label={isPlayingAmbient ? 'Stop ambient music' : 'Play ambient music'}
                title={isPlayingAmbient ? 'Stop ambient' : 'Play ambient music (1 min)'}
              >
                {isPlayingAmbient ? (
                  <svg className="play-all-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg className="play-all-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                )}
              </button>
            )}
            {effects.length > 0 && (
              <>
                <div className="sfx-volume-wrap" title="Sound effects volume (playback only)">
                  <svg className="sfx-volume-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={soundEffectsVolume}
                    onChange={(e) => setSoundEffectsVolume(parseFloat(e.target.value))}
                    className="sfx-volume-slider"
                    aria-label="Sound effects volume"
                  />
                </div>
                <button
                  type="button"
                  className="play-all-btn"
                  onClick={audioUrl ? handlePlayWithVoiceover : handlePlayAllEffects}
                aria-label={
                  audioUrl
                    ? (isPlayingWithVoiceover ? 'Stop' : 'Play voice-over with sound effects in sync')
                    : (isPlayingAll ? 'Stop' : 'Play all sound effects')
                }
                title={
                  audioUrl
                    ? (isPlayingWithVoiceover ? 'Stop' : 'Play transcribed audio with sound effects in time')
                    : (isPlayingAll ? 'Stop' : selectedEffectIndices.length > 0 ? 'Play from first selected through to end' : 'Play all from top')
                }
              >
                {(isPlayingWithVoiceover || isPlayingAll) ? (
                  <svg className="play-all-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg className="play-all-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                    <path d="M4 9h2v6H4zm14 0h2v6h-2z" opacity="0.8" />
                  </svg>
                )}
              </button>
              </>
            )}
            <button
              type="button"
              className="settings-btn"
              onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            title="Settings"
          >
            <svg className="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Settings
          </button>
          </div>
        }
      />
      {!backendTipDismissed && (
        <div className="backend-tip" role="status">
          <span>Start the backend so Transcribe works: run <code>npm run dev:all</code> in the project folder (runs frontend + backend), or in a second terminal run <code>npm run server</code>.</span>
          <button type="button" className="backend-tip-dismiss" onClick={dismissBackendTip} aria-label="Dismiss">×</button>
        </div>
      )}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <main
        ref={mainRef}
        className={`main ${transcript ? 'main-with-transcript' : ''}`}
      >
        <div
          className="main-left"
          style={transcript ? { width: leftPanelWidth, minWidth: MIN_PANEL, maxWidth: MAX_PANEL } : undefined}
        >
          <section className="card">
            <h2>1. Audio</h2>
            <div className="upload-area" onClick={() => fileInputRef.current?.click()}>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFile}
                className="hidden"
              />
              {audioUrl ? (
                <div className="audio-preview">
                  <audio src={audioUrl} controls className="audio-player" />
                  <span className="file-name">{audioFile?.name}</span>
                </div>
              ) : (
                <span>Click to choose an audio file (MP3, WAV, …)</span>
              )}
            </div>
            <button
              className="btn primary"
              onClick={handleTranscribe}
              disabled={!audioFile || transcribing}
            >
              {transcribing ? 'Transcribing…' : 'Transcribe (OpenAI only)'}
            </button>
          </section>

          {transcript && (
            <section className="card">
              <h2>2. Mark important parts</h2>
              <p className="transcript-hint">Click lines in the transcript (right) to select or deselect. Selected lines are used for sound effects.</p>
              <button
                className="btn primary"
                onClick={handleAnalyzeImportant}
                disabled={analyzing}
              >
                {analyzing ? 'Analyzing…' : 'Mark important parts & suggest direction (OpenAI)'}
              </button>
            </section>
          )}

          {(importantMoments.length > 0 || effects.length > 0) && (
            <section className="card generate-sound-effects-card">
              <h2>3. Generate sound effects</h2>
              <label className="field-label">Overall feel of the sound effects</label>
              <input
                type="text"
                className="feel-input"
                placeholder="e.g. dark and mysterious, upbeat and energetic, cinematic and subtle"
                value={overallFeel}
                onChange={(e) => setOverallFeel(e.target.value)}
              />
              <p className="feel-hint">Applied to every effect so they share the same style and atmosphere. Fill in before generating for a cohesive set.</p>
              <div className="generate-effects-wrap">
                {importantMoments.length > 0 && (
                  <button
                    className="btn primary"
                    onClick={handleGenerateEffects}
                    disabled={generating}
                  >
                    {generating ? 'Generating effects (ElevenLabs)…' : 'Generate sound effects (ElevenLabs)'}
                  </button>
                )}
                {effects.length > 0 && selectedEffectIndices.length > 0 && (
                  <button
                    className="btn secondary"
                    onClick={handleRegenerateEffects}
                    disabled={generating}
                  >
                    {generating ? 'Re-generating…' : `Re-generate sound effects (${selectedEffectIndices.length} selected)`}
                  </button>
                )}
                {importantMoments.length > 0 && (
                  <button
                    className="btn secondary"
                    onClick={handleGenerateAmbient}
                    disabled={generating || generatingAmbient}
                  >
                    {generatingAmbient ? 'Generating ambient music…' : 'Generate ambient music (ElevenLabs)'}
                  </button>
                )}
                {ambientSegments.length > 0 && (
                  <div className="ambient-player-wrap">
                    <label className="field-label">Ambient music (1 min, one segment per important moment)</label>
                    <div className="ambient-player-row">
                      <button
                        type="button"
                        className="btn secondary btn-play-ambient"
                        onClick={handlePlayAmbient}
                      >
                        {isPlayingAmbient ? 'Pause' : 'Play'} ambient
                      </button>
                      <audio
                        ref={ambientAudioRef}
                        src={ambientSegments[0]?.url}
                        controls
                        className="audio-player"
                        onPlay={() => setIsPlayingAmbient(true)}
                        onPause={() => setIsPlayingAmbient(false)}
                        onEnded={() => {
                          const segs = ambientSegmentsRef.current;
                          const idx = ambientSegmentIndexRef.current;
                          if (idx + 1 < segs.length) {
                            ambientSegmentIndexRef.current = idx + 1;
                            const audio = ambientAudioRef.current;
                            if (audio) {
                              audio.src = segs[idx + 1].url;
                              audio.currentTime = 0;
                              audio.play().catch(() => setIsPlayingAmbient(false));
                            } else {
                              setIsPlayingAmbient(false);
                            }
                          } else {
                            setIsPlayingAmbient(false);
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {effects.length > 0 && (
            <section className="card export-card">
              <h2>4. Export</h2>
              <div className="export-buttons">
                <button className="btn secondary" onClick={exportCueSheet}>
                  Export cue sheet (JSON)
                </button>
                <button className="btn primary" onClick={exportFull}>
                  Export ZIP (cue sheet + audio effects)
                </button>
              </div>
            </section>
          )}
        </div>

        {transcript && (
          <>
            <div
              className={`resizer resizer-left ${activeResizer === 'left' ? 'resizer-active' : ''}`}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize left panel"
              onMouseDown={handleResizeStart('left')}
            />
            <aside
              className="transcript-panel"
              style={{ width: transcriptPanelWidth, minWidth: MIN_PANEL, maxWidth: MAX_PANEL }}
            >
            <h2 className="transcript-panel-title">Transcript</h2>
            <p className="transcript-panel-hint">Click a line to select for sound effects; click again to deselect.</p>
            <p className="transcript-selected-count">
              {selectedSegmentIndices.length} section{selectedSegmentIndices.length !== 1 ? 's' : ''} selected
            </p>
            <div className="transcript-lines">
              {(transcript.segments || []).length > 0
                ? transcript.segments.map((seg, i) => {
                    const selected = selectedSegmentIndices.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`transcript-line ${selected ? 'transcript-line-selected' : ''}`}
                        onClick={() => toggleSegmentSelection(i)}
                        onKeyDown={(ev) => { if (ev.key === ' ') ev.preventDefault(); }}
                      >
                        <span className="transcript-line-time">
                          {Number(seg.start).toFixed(1)}s
                        </span>
                        <span className="transcript-line-text">{seg.text}</span>
                      </button>
                    );
                  })
                : (transcript.text || '')
                    .split(/\n+/)
                    .filter((l) => l.trim())
                    .map((line, i) => {
                      const selected = selectedSegmentIndices.includes(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          className={`transcript-line ${selected ? 'transcript-line-selected' : ''}`}
                          onClick={() => toggleSegmentSelection(i)}
                          onKeyDown={(ev) => { if (ev.key === ' ') ev.preventDefault(); }}
                        >
                          <span className="transcript-line-text">{line.trim()}</span>
                        </button>
                      );
                    })}
            </div>
            </aside>
            <div
              className={`resizer resizer-transcript ${activeResizer === 'transcript' ? 'resizer-active' : ''}`}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize transcript panel"
              onMouseDown={handleResizeStart('transcript')}
            />
            <div className="main-right">
        {importantMoments.length > 0 && (
          <section className="card">
            <h2>3. Important moments & sound direction</h2>
            <p className="moments-count">
              {importantMoments.length} important moment{importantMoments.length !== 1 ? 's' : ''}
            </p>
            {selectedSegmentIndices.length > 0 && selectedSegmentIndices.length !== importantMoments.length && (
              <div className="moments-sync-notice" role="status">
                You have {selectedSegmentIndices.length} section{selectedSegmentIndices.length !== 1 ? 's' : ''} selected but {importantMoments.length} important moment{importantMoments.length !== 1 ? 's' : ''}. Click &quot;Mark important parts&quot; again to generate moments for all selected sections.
              </div>
            )}
            {soundDirection && (
              <div className="sound-direction">
                <span className="direction-label">Suggested sound direction:</span>
                <span className="direction-value">{soundDirection}</span>
              </div>
            )}
            <div className="effect-duration">
              <label className="field-label">Effect duration (seconds)</label>
              <div className="duration-sliders">
                <div className="duration-row">
                  <span className="duration-label">Min</span>
                  <input
                    type="range"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={effectDurationMin}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setEffectDurationMin(v);
                      if (v > effectDurationMax) setEffectDurationMax(v);
                    }}
                    className="duration-slider"
                  />
                  <span className="duration-value">{effectDurationMin}s</span>
                </div>
                <div className="duration-row">
                  <span className="duration-label">Max</span>
                  <input
                    type="range"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={effectDurationMax}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setEffectDurationMax(v);
                      if (v < effectDurationMin) setEffectDurationMin(v);
                    }}
                    className="duration-slider"
                  />
                  <span className="duration-value">{effectDurationMax}s</span>
                </div>
              </div>
              <p className="duration-hint">Each effect will be a random length between min and max.</p>
            </div>
            {effects.length > 0 && (
              <p className="effects-select-hint">Click a card with a generated sound to select for re-generation.</p>
            )}
            <ul className="moments-list">
              {importantMoments.map((m, i) => {
                const effect = effects[i];
                const hasEffect = effect?.effectUrl;
                const selected = selectedEffectIndices.includes(i);
                return (
                  <li
                    key={i}
                    role={hasEffect ? 'button' : undefined}
                    tabIndex={hasEffect ? 0 : undefined}
                    className={`moment ${hasEffect ? 'moment-with-effect' : ''} ${selected ? 'moment-selected' : ''}`}
                    onClick={hasEffect ? () => toggleEffectSelection(i) : undefined}
                    onKeyDown={hasEffect ? (ev) => ev.key === 'Enter' && (ev.preventDefault(), toggleEffectSelection(i)) : undefined}
                  >
                    <span className="time">
                      {Number(m.start).toFixed(2)}s – {Number(m.end).toFixed(2)}s
                    </span>
                    <span className="text">"{m.text}"</span>
                    <span className="reason">{m.reason}</span>
                    <span className="effect-tag">{m.effectSuggestion || m.effectType || '—'}</span>
                    <textarea
                      className="moment-prompt-input"
                      aria-label="Prompt for sound effect (edit to change what ElevenLabs generates)"
                      value={
                        (momentPrompts[i] ?? m.elevenLabsPrompt ?? '').toString()
                      }
                      onChange={(e) => {
                        setMomentPrompts((prev) => {
                          const base = prev.length === importantMoments.length ? prev : importantMoments.map((mom) => mom.elevenLabsPrompt ?? '');
                          const next = [...base];
                          next[i] = e.target.value;
                          return next;
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="e.g. Soft whoosh, calm transition"
                      rows={2}
                    />
                    <label className="moment-duration-label" onClick={(e) => e.stopPropagation()}>
                      Duration (s)
                      <input
                        type="number"
                        min={0.5}
                        max={30}
                        step={0.5}
                        className="moment-duration-input"
                        aria-label="Override duration in seconds (leave empty for random)"
                        placeholder="empty = random"
                        value={momentDurations[i] ?? ''}
                        onChange={(e) => {
                          setMomentDurations((prev) => {
                            const base = prev.length === importantMoments.length ? prev : importantMoments.map(() => '');
                            const next = [...base];
                            next[i] = e.target.value;
                            return next;
                          });
                        }}
                      />
                    </label>
                    {hasEffect && (
                      <div className="moment-effect-row" onClick={(e) => e.stopPropagation()}>
                        <span className="moment-effect-duration">
                          {effect.durationSeconds != null ? `${Number(effect.durationSeconds).toFixed(1)}s` : '—'}
                        </span>
                        <audio src={effect.effectUrl} controls className="mini-player" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
            </div>
          </>
        )}

        {!transcript && importantMoments.length > 0 && (
          <section className="card">
            <h2>3. Important moments & sound direction</h2>
            <p className="moments-count">
              {importantMoments.length} important moment{importantMoments.length !== 1 ? 's' : ''}
            </p>
            {selectedSegmentIndices.length > 0 && selectedSegmentIndices.length !== importantMoments.length && (
              <div className="moments-sync-notice" role="status">
                You have {selectedSegmentIndices.length} section{selectedSegmentIndices.length !== 1 ? 's' : ''} selected but {importantMoments.length} important moment{importantMoments.length !== 1 ? 's' : ''}. Click &quot;Mark important parts&quot; again to generate moments for all selected sections.
              </div>
            )}
            {soundDirection && (
              <div className="sound-direction">
                <span className="direction-label">Suggested sound direction:</span>
                <span className="direction-value">{soundDirection}</span>
              </div>
            )}
            <div className="effect-duration">
              <label className="field-label">Effect duration (seconds)</label>
              <div className="duration-sliders">
                <div className="duration-row">
                  <span className="duration-label">Min</span>
                  <input
                    type="range"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={effectDurationMin}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setEffectDurationMin(v);
                      if (v > effectDurationMax) setEffectDurationMax(v);
                    }}
                    className="duration-slider"
                  />
                  <span className="duration-value">{effectDurationMin}s</span>
                </div>
                <div className="duration-row">
                  <span className="duration-label">Max</span>
                  <input
                    type="range"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={effectDurationMax}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setEffectDurationMax(v);
                      if (v < effectDurationMin) setEffectDurationMin(v);
                    }}
                    className="duration-slider"
                  />
                  <span className="duration-value">{effectDurationMax}s</span>
                </div>
              </div>
              <p className="duration-hint">Each effect will be a random length between min and max.</p>
            </div>
            {effects.length > 0 && (
              <p className="effects-select-hint">Click a card with a generated sound to select for re-generation.</p>
            )}
            <ul className="moments-list">
              {importantMoments.map((m, i) => {
                const effect = effects[i];
                const hasEffect = effect?.effectUrl;
                const selected = selectedEffectIndices.includes(i);
                return (
                  <li
                    key={i}
                    role={hasEffect ? 'button' : undefined}
                    tabIndex={hasEffect ? 0 : undefined}
                    className={`moment ${hasEffect ? 'moment-with-effect' : ''} ${selected ? 'moment-selected' : ''}`}
                    onClick={hasEffect ? () => toggleEffectSelection(i) : undefined}
                    onKeyDown={hasEffect ? (ev) => ev.key === 'Enter' && (ev.preventDefault(), toggleEffectSelection(i)) : undefined}
                  >
                    <span className="time">
                      {Number(m.start).toFixed(2)}s – {Number(m.end).toFixed(2)}s
                    </span>
                    <span className="text">"{m.text}"</span>
                    <span className="reason">{m.reason}</span>
                    <span className="effect-tag">{m.effectSuggestion || m.effectType || '—'}</span>
                    <textarea
                      className="moment-prompt-input"
                      aria-label="Prompt for sound effect (edit to change what ElevenLabs generates)"
                      value={
                        (momentPrompts[i] ?? m.elevenLabsPrompt ?? '').toString()
                      }
                      onChange={(e) => {
                        setMomentPrompts((prev) => {
                          const base = prev.length === importantMoments.length ? prev : importantMoments.map((mom) => mom.elevenLabsPrompt ?? '');
                          const next = [...base];
                          next[i] = e.target.value;
                          return next;
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="e.g. Soft whoosh, calm transition"
                      rows={2}
                    />
                    <label className="moment-duration-label" onClick={(e) => e.stopPropagation()}>
                      Duration (s)
                      <input
                        type="number"
                        min={0.5}
                        max={30}
                        step={0.5}
                        className="moment-duration-input"
                        aria-label="Override duration in seconds (leave empty for random)"
                        placeholder="empty = random"
                        value={momentDurations[i] ?? ''}
                        onChange={(e) => {
                          setMomentDurations((prev) => {
                            const base = prev.length === importantMoments.length ? prev : importantMoments.map(() => '');
                            const next = [...base];
                            next[i] = e.target.value;
                            return next;
                          });
                        }}
                      />
                    </label>
                    {hasEffect && (
                      <div className="moment-effect-row" onClick={(e) => e.stopPropagation()}>
                        <span className="moment-effect-duration">
                          {effect.durationSeconds != null ? `${Number(effect.durationSeconds).toFixed(1)}s` : '—'}
                        </span>
                        <audio src={effect.effectUrl} controls className="mini-player" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {!transcript && error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

import { useState, useRef, useCallback, useEffect } from 'react';
import { transcribeAudio } from '../services/openai';
import { getSettings } from '../utils/settings';
import './RambleRecorder.css';

export default function RambleRecorder({ onTranscription, onError, disabled }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [microphones, setMicrophones] = useState([]);
  const [selectedMicId, setSelectedMicId] = useState('');
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const rafIdRef = useRef(null);
  const cancelRequestedRef = useRef(false);

  // Enumerate microphones; optionally request permission first to get labels
  const refreshMicrophones = useCallback(async (requestPermission = false) => {
    try {
      if (requestPermission) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}` }));
      setMicrophones(mics);
      if (mics.length > 0 && !selectedMicId) {
        setSelectedMicId(mics[0].deviceId);
      }
      if (requestPermission) setMicPermissionGranted(true);
    } catch (err) {
      onError?.(err.message || 'Could not list microphones.');
    }
  }, [onError, selectedMicId]);

  useEffect(() => {
    refreshMicrophones(false);
  }, []);

  // Waveform: when recording, connect stream to analyser and draw
  useEffect(() => {
    if (!isRecording || !streamRef.current || !canvasRef.current) return;
    const stream = streamRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    analyserRef.current = analyser;
    audioContextRef.current = audioContext;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const w = canvas.width;
    const h = canvas.height;

    function draw() {
      const a = analyserRef.current;
      if (!a) return;
      a.getByteTimeDomainData(dataArray);
      ctx.fillStyle = 'var(--bg)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'var(--accent)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const sliceWidth = w / dataArray.length;
      let x = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128;
        const y = (v * h) / 2 + h / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      rafIdRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      analyserRef.current = null;
      try {
        audioContext.close();
      } catch (_) {}
      audioContextRef.current = null;
    };
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stop();
    }
    setIsRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    cancelRequestedRef.current = true;
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stop();
    }
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    onError?.('');
    if (microphones.length === 0) {
      onError?.('No microphone found. Please allow microphone access and try again.');
      await refreshMicrophones(true);
      return;
    }
    try {
      const audioConstraints = selectedMicId
        ? { audio: { deviceId: { exact: selectedMicId } } }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        const stream = streamRef.current;
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        if (cancelRequestedRef.current) {
          cancelRequestedRef.current = false;
          chunksRef.current = [];
          return;
        }
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size < 1000) {
          onError?.('Recording too short. Please try again.');
          return;
        }
        const apiKey = getSettings().openaiApiKey?.trim();
        if (!apiKey) {
          onError?.('Please set your OpenAI API key in Settings.');
          return;
        }
        setIsTranscribing(true);
        try {
          const text = await transcribeAudio(apiKey, blob);
          if (text) onTranscription?.(text);
        } catch (err) {
          onError?.(err.message || 'Transcription failed.');
        } finally {
          setIsTranscribing(false);
        }
      };

      mr.start(200);
      setIsRecording(true);
    } catch (err) {
      onError?.(err.message || 'Could not access microphone.');
      if (err.name === 'NotAllowedError') {
        await refreshMicrophones(true);
      }
    }
  }, [onTranscription, onError, microphones.length, selectedMicId, refreshMicrophones]);

  const handleToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const canRamble = microphones.length > 0 && (selectedMicId || microphones.length === 1);

  return (
    <div className="ramble-recorder">
      <div className="ramble-recorder__mic-row">
        <label className="ramble-recorder__mic-label" htmlFor="ramble-mic">
          Microphone
        </label>
        <select
          id="ramble-mic"
          className="ramble-recorder__mic-select"
          value={selectedMicId}
          onChange={(e) => setSelectedMicId(e.target.value)}
          disabled={isRecording || isTranscribing}
        >
          {microphones.length === 0 && (
            <option value="">No microphones — allow access</option>
          )}
          {microphones.map((mic) => (
            <option key={mic.deviceId} value={mic.deviceId}>
              {mic.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ramble-recorder__refresh"
          onClick={() => refreshMicrophones(true)}
          disabled={isRecording || isTranscribing}
          title="Refresh microphone list"
          aria-label="Refresh microphone list"
        >
          ↻
        </button>
      </div>

      {isRecording && (
        <div className="ramble-waveform">
          <canvas
            ref={canvasRef}
            className="ramble-waveform__canvas"
            width={280}
            height={48}
            aria-hidden="true"
          />
        </div>
      )}

      <div className="ramble-recorder__actions">
        <button
          type="button"
          className={`ramble-btn ${isRecording ? 'ramble-btn--stop' : ''}`}
          onClick={handleToggle}
          disabled={disabled || isTranscribing || !canRamble}
          title={isRecording ? 'Stop recording' : canRamble ? 'Record audio to transcribe' : 'Select a microphone first'}
        >
          {isTranscribing ? (
            <>
              <span className="ramble-btn__dot" />
              <span>Transcribing…</span>
            </>
          ) : isRecording ? (
            <>
              <span className="ramble-btn__pulse" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <svg className="ramble-btn__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <span>Ramble</span>
            </>
          )}
        </button>
        {isRecording && (
          <button
            type="button"
            className="ramble-btn ramble-btn--cancel"
            onClick={cancelRecording}
            disabled={disabled}
            title="Cancel recording without transcribing"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

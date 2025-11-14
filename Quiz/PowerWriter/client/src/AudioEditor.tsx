import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { Transcription } from "./types";
import { transcribeDocumentAudio, editDocumentAudio } from "./api";

type AudioEditorProps = {
  documentPath: string;
  audioUrl: string | null;
  transcription: Transcription | null;
  documentContent?: string | null;
  apiKey?: string;
  onTranscriptionUpdate?: (transcription: Transcription) => void;
  onPlayFromCursor?: (time: number) => void;
};

type WordBlock = {
  id: string;
  word: string;
  start: number;
  end: number;
  index: number;
};

type TranscriptionState = {
  words: Array<{ word: string; start: number; end: number }>;
  text: string;
  segments: Transcription["segments"];
  language: string;
  duration: number;
};

type Pause = {
  id: string;
  start: number;
  end: number;
  duration: number;
  beforeWordIndex: number;
  afterWordIndex: number;
};

export function AudioEditor({
  documentPath,
  audioUrl,
  transcription,
  documentContent,
  apiKey,
  onTranscriptionUpdate,
  onPlayFromCursor
}: AudioEditorProps) {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(
    null
  );
  const [currentTranscription, setCurrentTranscription] =
    useState<Transcription | null>(transcription);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [selectedPauseIds, setSelectedPauseIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartId, setDragStartId] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplyingEdits, setIsApplyingEdits] = useState(false);
  const [history, setHistory] = useState<TranscriptionState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [pauseThreshold, setPauseThreshold] = useState(0.5); // seconds
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (transcription) {
      setCurrentTranscription(transcription);
      // Initialize history with the original transcription
      const initialState: TranscriptionState = {
        words: transcription.words || [],
        text: transcription.text,
        segments: transcription.segments || [],
        language: transcription.language,
        duration: transcription.duration
      };
      setHistory([initialState]);
      setHistoryIndex(0);
      setSelectedWordIds(new Set());
      setSelectedPauseIds(new Set());
    }
  }, [transcription]);

  // Save state to history when transcription changes
  const saveToHistory = useCallback((state: TranscriptionState) => {
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(state);
      // Limit history to 50 states
      if (newHistory.length > 50) {
        newHistory.shift();
      } else {
        setHistoryIndex(newHistory.length - 1);
      }
      return newHistory;
    });
  }, [historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleUndo = useCallback(() => {
    if (!canUndo || !currentTranscription) return;
    
    const previousState = history[historyIndex - 1];
    const restored: Transcription = {
      ...currentTranscription,
      words: previousState.words,
      text: previousState.text,
      segments: previousState.segments
    };
    
    setCurrentTranscription(restored);
    setHistoryIndex(historyIndex - 1);
    setSelectedWordIds(new Set());
    setSelectedPauseIds(new Set());
    onTranscriptionUpdate?.(restored);
  }, [canUndo, historyIndex, history, currentTranscription, onTranscriptionUpdate]);

  const handleRedo = useCallback(() => {
    if (!canRedo || !currentTranscription) return;
    
    const nextState = history[historyIndex + 1];
    const restored: Transcription = {
      ...currentTranscription,
      words: nextState.words,
      text: nextState.text,
      segments: nextState.segments
    };
    
    setCurrentTranscription(restored);
    setHistoryIndex(historyIndex + 1);
    setSelectedWordIds(new Set());
    setSelectedPauseIds(new Set());
    onTranscriptionUpdate?.(restored);
  }, [canRedo, historyIndex, history, currentTranscription, onTranscriptionUpdate]);

  // Load audio buffer for preview
  useEffect(() => {
    if (!audioUrl || audioContextRef.current) return;

    const loadAudio = async () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;

        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        audioBufferRef.current = audioBuffer;
      } catch (error) {
        console.error("Failed to load audio for preview:", error);
      }
    };

    loadAudio();

    return () => {
      if (previewSourceRef.current) {
        try {
          previewSourceRef.current.stop();
        } catch {}
      }
    };
  }, [audioUrl]);

  const wordBlocks = useMemo<WordBlock[]>(() => {
    if (!currentTranscription?.words) return [];

    return currentTranscription.words.map((word, index) => ({
      id: `word-${index}-${word.start}-${word.end}`,
      word: word.word.trim(),
      start: word.start,
      end: word.end,
      index
    }));
  }, [currentTranscription?.words, currentTranscription?.text]);

  // Detect pauses (gaps between words longer than threshold)
  // Store original word blocks to preserve pause relationships even after edits
  const originalWordBlocks = useMemo(() => {
    if (!currentTranscription?.words) return [];
    return currentTranscription.words.map((word, index) => ({
      id: `word-${index}-${word.start}-${word.end}`,
      word: word.word.trim(),
      start: word.start,
      end: word.end,
      index
    }));
  }, [currentTranscription?.words]);

  const pauses = useMemo<Pause[]>(() => {
    if (!wordBlocks || wordBlocks.length < 2) return [];

    const detected: Pause[] = [];
    for (let i = 0; i < wordBlocks.length - 1; i++) {
      const currentWord = wordBlocks[i];
      const nextWord = wordBlocks[i + 1];
      const gap = nextWord.start - currentWord.end;
      
      if (gap > pauseThreshold) {
        detected.push({
          id: `pause-${i}-${currentWord.end}-${nextWord.start}`,
          start: currentWord.end,
          end: nextWord.start,
          duration: gap,
          beforeWordIndex: i,
          afterWordIndex: i + 1
        });
      }
    }
    return detected;
  }, [wordBlocks, pauseThreshold]);

  // Determine line breaks based on document content
  const lineBreakIndicesSimple = useMemo<Set<number>>(() => {
    if (!documentContent || !wordBlocks.length) {
      return new Set();
    }

    const breaks = new Set<number>();
    const docLines = documentContent.split('\n').filter(line => line.trim().length > 0);
    
    if (docLines.length <= 1) {
      return breaks; // No line breaks if document has only one line
    }
    
    let wordBlockIndex = 0;
    
    for (let lineIdx = 0; lineIdx < docLines.length - 1; lineIdx++) {
      const line = docLines[lineIdx];
      const nextLine = docLines[lineIdx + 1];
      
      const lineWords = line
        .toLowerCase()
        .split(/\s+/)
        .filter(w => {
          const clean = w.replace(/[.,!?;:—–\-"']/g, '').trim();
          return clean.length > 0;
        });
      
      const nextLineFirstWord = nextLine
        .toLowerCase()
        .split(/\s+/)
        .find(w => {
          const clean = w.replace(/[.,!?;:—–\-"']/g, '').trim();
          return clean.length > 0;
        });
      
      if (!nextLineFirstWord || lineWords.length === 0) continue;
      
      // Find where this line's words end in wordBlocks
      let matchedWords = 0;
      let lastMatchedIndex = -1;
      
      for (let i = wordBlockIndex; i < wordBlocks.length; i++) {
        const blockWord = wordBlocks[i].word.toLowerCase().replace(/[.,!?;:—–\-"']/g, '').trim();
        
        if (matchedWords < lineWords.length) {
          const expectedWord = lineWords[matchedWords];
          if (blockWord === expectedWord) {
            matchedWords++;
            lastMatchedIndex = i;
            
            // Check if we've matched all words in this line
            if (matchedWords === lineWords.length) {
              // Check if next word is the start of next line
              if (i + 1 < wordBlocks.length) {
                const nextBlockWord = wordBlocks[i + 1].word.toLowerCase().replace(/[.,!?;:—–\-"']/g, '').trim();
                if (nextBlockWord === nextLineFirstWord) {
                  breaks.add(i); // Break after this word
                  wordBlockIndex = i + 1;
                  break;
                }
              }
            }
          } else if (matchedWords > 0) {
            // Partial match failed, reset
            matchedWords = 0;
            lastMatchedIndex = -1;
          }
        }
      }
      
      // If we found a match but didn't find the next line start, try to continue from last match
      if (lastMatchedIndex >= 0 && lastMatchedIndex + 1 < wordBlocks.length) {
        wordBlockIndex = lastMatchedIndex + 1;
      }
    }
    
    return breaks;
  }, [documentContent, wordBlocks]);

  const handleTranscribe = useCallback(async () => {
    if (!audioUrl) {
      setTranscriptionError("No audio file available");
      return;
    }

    setIsTranscribing(true);
    setTranscriptionError(null);

    try {
      const result = await transcribeDocumentAudio(documentPath, apiKey);
      setCurrentTranscription(result.transcription);
      onTranscriptionUpdate?.(result.transcription);
      setSelectedWordIds(new Set());
      setSelectedPauseIds(new Set());
      // Reset history
      const initialState: TranscriptionState = {
        words: result.transcription.words || [],
        text: result.transcription.text,
        segments: result.transcription.segments || [],
        language: result.transcription.language,
        duration: result.transcription.duration
      };
      setHistory([initialState]);
      setHistoryIndex(0);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to transcribe audio";
      setTranscriptionError(message);
    } finally {
      setIsTranscribing(false);
    }
  }, [documentPath, audioUrl, apiKey, onTranscriptionUpdate]);

  const handleWordMouseDown = useCallback(
    (wordId: string, event: React.MouseEvent) => {
      event.preventDefault();
      setDragStartId(wordId);
      setIsDragging(false);
      
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        // Multi-select toggle
        setSelectedWordIds((prev) => {
          const next = new Set(prev);
          if (next.has(wordId)) {
            next.delete(wordId);
          } else {
            next.add(wordId);
          }
          return next;
        });
      } else {
        // Start new selection
        setSelectedWordIds(new Set([wordId]));
        setSelectedPauseIds(new Set());
      }
    },
    []
  );

  const handleWordMouseEnter = useCallback(
    (wordId: string) => {
      if (dragStartId && isDragging) {
        // Select range from dragStart to current word
        const startIndex = wordBlocks.findIndex((b) => b.id === dragStartId);
        const endIndex = wordBlocks.findIndex((b) => b.id === wordId);
        
        if (startIndex !== -1 && endIndex !== -1) {
          const start = Math.min(startIndex, endIndex);
          const end = Math.max(startIndex, endIndex);
          const rangeIds = new Set(
            wordBlocks.slice(start, end + 1).map((b) => b.id)
          );
          setSelectedWordIds(rangeIds);
          setSelectedPauseIds(new Set());
        }
      }
    },
    [dragStartId, isDragging, wordBlocks]
  );

  const handleWordMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStartId(null);
  }, []);

  // Handle drag selection on container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (dragStartId) {
        setIsDragging(true);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragStartId(null);
    };

    container.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragStartId]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedWordIds.size === 0 && selectedPauseIds.size === 0) return;

    let newWords = [...wordBlocks];
    
    // Delete selected words
    if (selectedWordIds.size > 0) {
      newWords = newWords.filter((block) => !selectedWordIds.has(block.id));
    }

    // Adjust selected pauses (delete = compress to 0.1s)
    if (selectedPauseIds.size > 0) {
      const adjustedWords = [...newWords];
      
      // Recalculate pauses based on current wordBlocks (before deletion)
      // Find which pauses correspond to gaps between remaining words
      for (let i = 0; i < adjustedWords.length - 1; i++) {
        const currentWord = adjustedWords[i];
        const nextWord = adjustedWords[i + 1];
        const gap = nextWord.start - currentWord.end;
        
        // Check if this gap matches a selected pause (by timestamp)
        const matchingPause = pauses.find(
          (p) => Math.abs(p.start - currentWord.end) < 0.01 && 
                 Math.abs(p.end - nextWord.start) < 0.01 &&
                 selectedPauseIds.has(p.id)
        );
        
        if (matchingPause && gap > pauseThreshold) {
          // Compress pause to 0.1 seconds
          const newEnd = currentWord.end + 0.1;
          const shiftAmount = nextWord.start - newEnd;
          // Shift all subsequent words
          for (let j = i + 1; j < adjustedWords.length; j++) {
            adjustedWords[j] = {
              ...adjustedWords[j],
              start: adjustedWords[j].start - shiftAmount,
              end: adjustedWords[j].end - shiftAmount
            };
          }
        }
      }
      newWords = adjustedWords;
    }
    
    if (newWords.length === 0) {
      setTranscriptionError("Cannot delete all words");
      return;
    }

    // Update transcription
    const updated: Transcription = {
      ...currentTranscription!,
      words: newWords.map((block) => ({
        word: block.word,
        start: block.start,
        end: block.end
      })),
      text: newWords.map((block) => block.word).join(" "),
      segments: currentTranscription?.segments || []
    };

    // Save to history
    const state: TranscriptionState = {
      words: updated.words,
      text: updated.text,
      segments: updated.segments,
      language: updated.language,
      duration: updated.duration
    };
    saveToHistory(state);

    setCurrentTranscription(updated);
    setSelectedWordIds(new Set());
    setSelectedPauseIds(new Set());
    onTranscriptionUpdate?.(updated);
    setTranscriptionError(null);
  }, [selectedWordIds, selectedPauseIds, wordBlocks, pauses, currentTranscription, onTranscriptionUpdate, saveToHistory]);

  const handleAdjustPause = useCallback((pauseId: string, newDuration: number) => {
    const pause = pauses.find((p) => p.id === pauseId);
    if (!pause) return;

    const newWords = [...wordBlocks];
    const beforeWord = newWords[pause.beforeWordIndex];
    const afterWord = newWords[pause.afterWordIndex];
    
    if (beforeWord && afterWord) {
      const currentGap = pause.duration;
      const newGap = Math.max(0.05, newDuration); // Minimum 50ms
      const shiftAmount = newGap - currentGap;
      
      // Adjust the pause: set afterWord.start to create the new gap
      const newAfterWordStart = beforeWord.end + newGap;
      const timeShift = newAfterWordStart - afterWord.start;
      
      // Shift all subsequent words
      for (let i = pause.afterWordIndex; i < newWords.length; i++) {
        newWords[i] = {
          ...newWords[i],
          start: newWords[i].start + timeShift,
          end: newWords[i].end + timeShift
        };
      }

      const updated: Transcription = {
        ...currentTranscription!,
        words: newWords.map((block) => ({
          word: block.word,
          start: block.start,
          end: block.end
        })),
        text: newWords.map((block) => block.word).join(" "),
        segments: currentTranscription?.segments || []
      };

      // Save to history
      const state: TranscriptionState = {
        words: updated.words,
        text: updated.text,
        segments: updated.segments,
        language: updated.language,
        duration: updated.duration
      };
      saveToHistory(state);

      setCurrentTranscription(updated);
      onTranscriptionUpdate?.(updated);
    }
  }, [wordBlocks, pauses, currentTranscription, onTranscriptionUpdate, saveToHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo (Ctrl/Cmd + Z)
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      // Redo (Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y)
      if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key === "z") || e.key === "y")) {
        e.preventDefault();
        handleRedo();
        return;
      }
      // Delete or Backspace key
      if ((e.key === "Delete" || e.key === "Backspace") && (selectedWordIds.size > 0 || selectedPauseIds.size > 0)) {
        e.preventDefault();
        handleDeleteSelected();
      }
      // Escape to deselect all
      if (e.key === "Escape" && (selectedWordIds.size > 0 || selectedPauseIds.size > 0)) {
        e.preventDefault();
        setSelectedWordIds(new Set());
        setSelectedPauseIds(new Set());
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedWordIds, selectedPauseIds, handleDeleteSelected, handleUndo, handleRedo]);

  const handleStopPreview = useCallback(() => {
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
      } catch {}
      previewSourceRef.current = null;
    }
    setIsPreviewing(false);
  }, []);

  const handlePreview = useCallback(async () => {
    if (isPreviewing) {
      // If already previewing, stop it
      handleStopPreview();
      return;
    }

    if (!audioBufferRef.current || !audioContextRef.current) {
      return;
    }

    const audioContext = audioContextRef.current;
    const audioBuffer = audioBufferRef.current;

    // Stop any existing preview
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
      } catch {}
    }

    setIsPreviewing(true);
    setTranscriptionError(null);

    try {
      // Get all visible word blocks (the current wordBlocks already excludes deleted ones)
      let blocksToPlay = wordBlocks;

      // If words are selected, start from the first selected word and play forward
      if (selectedWordIds.size > 0) {
        const firstSelectedIndex = wordBlocks.findIndex((block) => selectedWordIds.has(block.id));
        if (firstSelectedIndex >= 0) {
          // Play from the first selected word onwards
          blocksToPlay = wordBlocks.slice(firstSelectedIndex);
        }
      }

      if (blocksToPlay.length === 0) {
        setTranscriptionError("No audio to preview");
        setIsPreviewing(false);
        return;
      }

      // Calculate total duration needed including pauses
      let totalDuration = 0;
      for (let i = 0; i < blocksToPlay.length; i++) {
        const block = blocksToPlay[i];
        totalDuration += (block.end - block.start);
        // Add pause duration after each word (except the last)
        if (i < blocksToPlay.length - 1) {
          const nextBlock = blocksToPlay[i + 1];
          const gap = nextBlock.start - block.end;
          if (gap > 0) {
            totalDuration += gap; // Include the pause duration
          }
        }
      }
      
      const sampleRate = audioBuffer.sampleRate;
      const totalSamples = Math.ceil(totalDuration * sampleRate);
      
      // Create a new audio buffer for the edited audio
      const newBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        totalSamples,
        sampleRate
      );

      let offsetSamples = 0;

      // Copy each segment in order, including pauses (silence)
      for (let i = 0; i < blocksToPlay.length; i++) {
        const block = blocksToPlay[i];
        const startSample = Math.floor(block.start * sampleRate);
        const endSample = Math.floor(block.end * sampleRate);
        const blockSamples = endSample - startSample;

        // Copy audio data for each channel
        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
          const originalData = audioBuffer.getChannelData(channel);
          const newData = newBuffer.getChannelData(channel);
          
          // Copy the word segment to the new buffer
          const maxCopy = Math.min(blockSamples, originalData.length - startSample, newData.length - offsetSamples);
          for (let j = 0; j < maxCopy; j++) {
            if (offsetSamples + j < newData.length && startSample + j < originalData.length) {
              newData[offsetSamples + j] = originalData[startSample + j];
            }
          }
        }

        offsetSamples += blockSamples;

        // Add pause (silence) after this word (except the last)
        if (i < blocksToPlay.length - 1) {
          const nextBlock = blocksToPlay[i + 1];
          const gap = nextBlock.start - block.end;
          if (gap > 0) {
            // Copy the pause segment from the original audio to preserve any audio at boundaries
            // This ensures we don't cut into the next word
            const pauseStartSample = Math.floor(block.end * sampleRate);
            const pauseEndSample = Math.floor(nextBlock.start * sampleRate);
            const pauseSamples = pauseEndSample - pauseStartSample;
            
            if (pauseSamples > 0) {
              // Copy the pause segment from original audio (preserves audio at boundaries)
              for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                const originalChannelData = audioBuffer.getChannelData(channel);
                const newChannelData = newBuffer.getChannelData(channel);
                
                const maxCopy = Math.min(pauseSamples, originalChannelData.length - pauseStartSample, newChannelData.length - offsetSamples);
                for (let j = 0; j < maxCopy; j++) {
                  if (offsetSamples + j < newChannelData.length && pauseStartSample + j < originalChannelData.length) {
                    newChannelData[offsetSamples + j] = originalChannelData[pauseStartSample + j];
                  }
                }
              }
              
              offsetSamples += pauseSamples;
            }
          }
        }
      }

      // Play the new buffer
      const source = audioContext.createBufferSource();
      source.buffer = newBuffer;
      source.connect(audioContext.destination);
      previewSourceRef.current = source;

      source.onended = () => {
        setIsPreviewing(false);
        previewSourceRef.current = null;
      };

      source.start(0);
    } catch (error) {
      console.error("Preview error:", error);
      setTranscriptionError("Failed to preview audio: " + (error instanceof Error ? error.message : "Unknown error"));
      setIsPreviewing(false);
    }
  }, [wordBlocks, isPreviewing, handleStopPreview]);

  const handleSaveEdits = useCallback(async () => {
    if (!currentTranscription) return;

    const visibleBlocks = wordBlocks;
    
    // Create segments including pauses between words
    const segments: Array<{ start: number; end: number }> = [];
    
    for (let i = 0; i < visibleBlocks.length; i++) {
      const block = visibleBlocks[i];
      
      // Add the word segment
      segments.push({
        start: block.start,
        end: block.end
      });
      
      // Add pause segment after this word (except the last)
      if (i < visibleBlocks.length - 1) {
        const nextBlock = visibleBlocks[i + 1];
        const gap = nextBlock.start - block.end;
        if (gap > 0) {
          // Include the pause as silence in the output
          segments.push({
            start: block.end,
            end: nextBlock.start
          });
        }
      }
    }

    if (segments.length === 0) {
      setTranscriptionError("No audio segments remaining");
      return;
    }

    setIsApplyingEdits(true);
    setTranscriptionError(null);

    try {
      // Apply audio edits on server (requires ffmpeg)
      // The server should concatenate all segments (words + pauses) to preserve timing
      const result = await editDocumentAudio(documentPath, segments);
      
      if (result.audioUrl) {
        // Reload to get the edited audio
        window.location.reload();
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to apply audio edits";
      setTranscriptionError(message);
    } finally {
      setIsApplyingEdits(false);
    }
  }, [currentTranscription, wordBlocks, documentPath]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const hasTranscription = Boolean(currentTranscription);
  const duration = currentTranscription?.duration || 0;

  return (
    <div className="audio-editor">

      {transcriptionError && (
        <div className="audio-editor-error">{transcriptionError}</div>
      )}

      {!audioUrl && (
        <div className="audio-editor-message">
          No audio file available. Record audio first.
        </div>
      )}

      {audioUrl && !hasTranscription && (
        <div className="audio-editor-message">
          <button
            className="audio-editor-button"
            onClick={handleTranscribe}
            disabled={isTranscribing}
          >
            {isTranscribing ? "Transcribing..." : "Transcribe Audio"}
          </button>
        </div>
      )}

      {hasTranscription && (
        <>
          <div className="audio-editor-top-actions">
            <div className="audio-editor-controls-bar">
              <div className="audio-editor-undo-redo">
                <button
                  className="audio-editor-button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  title="Undo (Ctrl/Cmd + Z)"
                >
                  ↶ Undo
                </button>
                <button
                  className="audio-editor-button"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  title="Redo (Ctrl/Cmd + Shift + Z)"
                >
                  ↷ Redo
                </button>
              </div>
              <div className="audio-editor-pause-threshold">
                <label>
                  Pause threshold:{" "}
                  <input
                    type="number"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={pauseThreshold}
                    onChange={(e) => setPauseThreshold(parseFloat(e.target.value) || 0.5)}
                    style={{
                      width: "60px",
                      padding: "4px 8px",
                      background: "var(--field-bg)",
                      border: "1px solid var(--field-border)",
                      borderRadius: "4px",
                      color: "var(--text-primary)"
                    }}
                  />
                  s
                </label>
              </div>
            </div>

            <div className="audio-editor-actions">
              <button
                className="audio-editor-button"
                onClick={handleDeleteSelected}
                disabled={selectedWordIds.size === 0 && selectedPauseIds.size === 0}
              >
                Delete Selected ({selectedWordIds.size + selectedPauseIds.size})
              </button>
              <button
                className="audio-editor-button"
                onClick={isPreviewing ? handleStopPreview : handlePreview}
                disabled={wordBlocks.length === 0}
              >
                {isPreviewing ? "⏸ Stop Preview" : "▶ Preview"}
              </button>
              <button
                className="audio-editor-button"
                onClick={handleTranscribe}
                disabled={isTranscribing || !audioUrl}
                title="Reset all edits and re-transcribe from original audio"
              >
                {isTranscribing ? "Re-transcribing..." : "↺ Reset & Re-transcribe"}
              </button>
              <button
                className="audio-editor-button"
                onClick={handleSaveEdits}
                disabled={isApplyingEdits}
              >
                {isApplyingEdits ? "Applying edits..." : "Save Edits"}
              </button>
            </div>
          </div>

          <div 
            ref={containerRef}
            className="audio-editor-words-container"
            onMouseUp={handleWordMouseUp}
          >
            {wordBlocks.map((block, index) => {
              const isSelected = selectedWordIds.has(block.id);
              const nextBlock = wordBlocks[index + 1];
              // Find pause after this word
              const pauseAfter = pauses.find(
                (p) => p.beforeWordIndex === index
              ) || null;
              const isPauseSelected = pauseAfter && selectedPauseIds.has(pauseAfter.id);
              // Line break for long pauses OR document line breaks
              const shouldBreakLine = (pauseAfter && pauseAfter.duration >= 1.0) || 
                                     (index < wordBlocks.length - 1 && lineBreakIndicesSimple.has(index));

              return (
                <React.Fragment key={block.id}>
                  <button
                    type="button"
                    className={clsx("audio-editor-word-block", {
                      "audio-editor-word-selected": isSelected
                    })}
                    onMouseDown={(e) => handleWordMouseDown(block.id, e)}
                    onMouseEnter={() => handleWordMouseEnter(block.id)}
                    title={`${formatTime(block.start)} - ${formatTime(block.end)}`}
                  >
                    {block.word}
                  </button>
                  {pauseAfter && (
                    <>
                      <div
                        className={clsx("audio-editor-pause-block", {
                          "audio-editor-pause-selected": isPauseSelected
                        })}
                        onClick={(e) => {
                          e.preventDefault();
                          if (e.shiftKey || e.metaKey || e.ctrlKey) {
                            setSelectedPauseIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(pauseAfter.id)) {
                                next.delete(pauseAfter.id);
                              } else {
                                next.add(pauseAfter.id);
                              }
                              return next;
                            });
                          } else {
                            setSelectedPauseIds(new Set([pauseAfter.id]));
                            setSelectedWordIds(new Set());
                          }
                        }}
                        title={`Pause: ${pauseAfter.duration.toFixed(2)}s (${formatTime(pauseAfter.start)} - ${formatTime(pauseAfter.end)})`}
                      >
                        <span className="audio-editor-pause-duration">
                          {pauseAfter.duration.toFixed(2)}s
                        </span>
                        <div className="audio-editor-pause-controls">
                          <button
                            type="button"
                            className="audio-editor-pause-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAdjustPause(pauseAfter.id, pauseAfter.duration - 0.1);
                            }}
                            title="Shorten pause by 0.1s"
                          >
                            −
                          </button>
                          <button
                            type="button"
                            className="audio-editor-pause-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAdjustPause(pauseAfter.id, pauseAfter.duration + 0.1);
                            }}
                            title="Lengthen pause by 0.1s"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      {shouldBreakLine && <br className="audio-editor-line-break" />}
                    </>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <audio ref={audioRef} src={audioUrl || undefined} style={{ display: "none" }} />
        </>
      )}
    </div>
  );
}

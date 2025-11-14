import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { Transcription } from "./types";
import { transcribeDocumentAudio, editDocumentAudio, enhanceDocumentAudio, exportAudioAsMp3 } from "./api";

// Icon components for recording controls
type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

const createIcon = (path: React.ReactNode, viewBox = "0 0 24 24") =>
  function Icon({ size = 18, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {path}
      </svg>
    );
  };

const IconRecord = createIcon(
  <circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" />
);
const IconStop = createIcon(<rect x="7" y="7" width="10" height="10" rx="2" />);
const IconPlay = createIcon(
  <polygon points="9 6.5 18 12 9 17.5" fill="currentColor" stroke="none" />
);
const IconPause = createIcon(
  <>
    <rect x="7" y="6" width="3.5" height="12" rx="1.2" />
    <rect x="13.5" y="6" width="3.5" height="12" rx="1.2" />
  </>
);
const IconRewind = createIcon(
  <>
    <polygon points="11 12 19 7 19 17" />
    <polygon points="5 12 13 7 13 17" />
  </>
);

type AudioEditorProps = {
  documentPath: string;
  audioUrl: string | null;
  transcription: Transcription | null;
  documentContent?: string | null;
  apiKey?: string;
  onTranscriptionUpdate?: (transcription: Transcription) => void;
  onPlayFromCursor?: (time: number) => void;
  // Recording props
  isRecordingAudio?: boolean;
  recordingElapsed?: number;
  recordingFileName?: string | null;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onPlayAudio?: () => void;
  onPauseAudio?: () => void;
  onRewindAudio?: () => void;
  canStartRecording?: boolean;
  hasAudio?: boolean;
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
  onPlayFromCursor,
  isRecordingAudio = false,
  recordingElapsed = 0,
  recordingFileName = null,
  onStartRecording,
  onStopRecording,
  onPlayAudio,
  onPauseAudio,
  onRewindAudio,
  canStartRecording = false,
  hasAudio = false
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
  const isPreviewingRef = useRef(false); // Ref to track preview state for callbacks
  const [isApplyingEdits, setIsApplyingEdits] = useState(false);
  const [isApplyingAiSound, setIsApplyingAiSound] = useState(false);
  const [isExportingMp3, setIsExportingMp3] = useState(false);
  const [history, setHistory] = useState<TranscriptionState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [pauseThreshold, setPauseThreshold] = useState(0.5); // seconds
  const [currentPlayingWordId, setCurrentPlayingWordId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playbackStartTimeRef = useRef<number | null>(null);
  const playbackAnimationFrameRef = useRef<number | null>(null);
  const playbackBlocksRef = useRef<Array<{ id: string; start: number; end: number }>>([]);

  useEffect(() => {
    if (transcription) {
      // Store original indices in the transcription words
      const transcriptionWithIndices = {
        ...transcription,
        words: transcription.words.map((word, index) => ({
          ...word,
          originalIndex: index
        }))
      };
      setCurrentTranscription(transcriptionWithIndices as any);
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

  // Store original word timestamps for audio copying - must be defined before handleUndo/handleRedo
  const originalWordTimestamps = useMemo(() => {
    if (!transcription?.words) return new Map<number, { start: number; end: number }>();
    const map = new Map<number, { start: number; end: number }>();
    transcription.words.forEach((word, index) => {
      map.set(index, { start: word.start, end: word.end });
    });
    return map;
  }, [transcription?.words]);

  const handleUndo = useCallback(async () => {
    if (!canUndo || !currentTranscription || !transcription) return;
    
    const previousState = history[historyIndex - 1];
    // Restore words and ensure originalIndex is preserved by mapping back to original transcription
    const restoredWords = previousState.words.map((word, currentIndex) => {
      // originalIndex should be preserved in history state, but if missing, try to find it
      const existingOriginalIndex = (word as any).originalIndex;
      const existingDeleted = (word as any).deleted || false;
      if (existingOriginalIndex !== undefined) {
        return {
          ...word,
          originalIndex: existingOriginalIndex,
          deleted: existingDeleted
        } as any;
      }
      
      // Fallback: Try to find the word in the original transcription
      const originalWordIndex = transcription.words.findIndex((origWord, origIdx) => {
        const origWordText = origWord.word.trim().toLowerCase();
        const currentWordText = word.word.trim().toLowerCase();
        // Match by word text and approximate timestamp (within 0.5 seconds)
        return origWordText === currentWordText && 
               Math.abs(origWord.start - word.start) < 0.5;
      });
      
      return {
        ...word,
        originalIndex: originalWordIndex >= 0 ? originalWordIndex : currentIndex,
        deleted: existingDeleted
      } as any;
    });
    
    const nonDeletedRestoredWords = restoredWords.filter((w: any) => !w.deleted);
    const restored: Transcription = {
      ...currentTranscription,
      words: restoredWords,
      text: nonDeletedRestoredWords.map((w: any) => w.word).join(" "),
      segments: previousState.segments
    };
    
    setCurrentTranscription(restored);
    setHistoryIndex(historyIndex - 1);
    setSelectedWordIds(new Set());
    setSelectedPauseIds(new Set());
    onTranscriptionUpdate?.(restored);
    
    // CRITICAL: Update audio file to reflect undo
    // Apply audio edits based on restored transcription
    if (audioBufferRef.current && audioContextRef.current && nonDeletedRestoredWords.length > 0) {
      try {
        // Compute segments for the restored transcription (excluding deleted words)
        const currentBlocks = nonDeletedRestoredWords.map((word: any, index: number) => ({
          id: `word-${index}-${word.start}-${word.end}`,
          word: word.word.trim(),
          start: word.start,
          end: word.end,
          index: (word as any).originalIndex !== undefined ? (word as any).originalIndex : index
        }));
        
        const segments: Array<{ start: number; end: number }> = [];
        
        for (let i = 0; i < currentBlocks.length; i++) {
          const block = currentBlocks[i];
          const originalTimestamps = originalWordTimestamps.get(block.index);
          if (!originalTimestamps) continue;
          
          segments.push({
            start: originalTimestamps.start,
            end: originalTimestamps.end
          });
          
          if (i < currentBlocks.length - 1) {
            const nextBlock = currentBlocks[i + 1];
            const nextOriginalTimestamps = originalWordTimestamps.get(nextBlock.index);
            if (nextOriginalTimestamps) {
              const originalGap = nextOriginalTimestamps.start - originalTimestamps.end;
              if (originalGap > 0) {
                segments.push({
                  start: originalTimestamps.end,
                  end: nextOriginalTimestamps.start
                });
              }
            }
          }
        }
        
        if (segments.length > 0) {
          await editDocumentAudio(documentPath, segments);
          window.location.reload(); // Reload to get updated audio
        }
      } catch (error) {
        console.error("Failed to update audio after undo:", error);
        setTranscriptionError("Failed to update audio file after undo");
      }
    }
  }, [canUndo, historyIndex, history, currentTranscription, transcription, onTranscriptionUpdate, documentPath, originalWordTimestamps]);

  const handleRedo = useCallback(async () => {
    if (!canRedo || !currentTranscription || !transcription) return;
    
    const nextState = history[historyIndex + 1];
    // Restore words and ensure originalIndex is preserved by mapping back to original transcription
    const restoredWords = nextState.words.map((word, currentIndex) => {
      // originalIndex should be preserved in history state, but if missing, try to find it
      const existingOriginalIndex = (word as any).originalIndex;
      const existingDeleted = (word as any).deleted || false;
      if (existingOriginalIndex !== undefined) {
        return {
          ...word,
          originalIndex: existingOriginalIndex,
          deleted: existingDeleted
        } as any;
      }
      
      // Fallback: Try to find the word in the original transcription
      const originalWordIndex = transcription.words.findIndex((origWord, origIdx) => {
        const origWordText = origWord.word.trim().toLowerCase();
        const currentWordText = word.word.trim().toLowerCase();
        // Match by word text and approximate timestamp (within 0.5 seconds)
        return origWordText === currentWordText && 
               Math.abs(origWord.start - word.start) < 0.5;
      });
      
      return {
        ...word,
        originalIndex: originalWordIndex >= 0 ? originalWordIndex : currentIndex,
        deleted: existingDeleted
      } as any;
    });
    
    const nonDeletedRestoredWords = restoredWords.filter((w: any) => !w.deleted);
    const restored: Transcription = {
      ...currentTranscription,
      words: restoredWords,
      text: nonDeletedRestoredWords.map((w: any) => w.word).join(" "),
      segments: nextState.segments
    };
    
    setCurrentTranscription(restored);
    setHistoryIndex(historyIndex + 1);
    setSelectedWordIds(new Set());
    setSelectedPauseIds(new Set());
    onTranscriptionUpdate?.(restored);
    
    // CRITICAL: Update audio file to reflect redo
    // Apply audio edits based on restored transcription
    if (audioBufferRef.current && audioContextRef.current && nonDeletedRestoredWords.length > 0) {
      try {
        // Compute segments for the restored transcription (excluding deleted words)
        const currentBlocks = nonDeletedRestoredWords.map((word: any, index: number) => ({
          id: `word-${index}-${word.start}-${word.end}`,
          word: word.word.trim(),
          start: word.start,
          end: word.end,
          index: (word as any).originalIndex !== undefined ? (word as any).originalIndex : index
        }));
        
        const segments: Array<{ start: number; end: number }> = [];
        
        for (let i = 0; i < currentBlocks.length; i++) {
          const block = currentBlocks[i];
          const originalTimestamps = originalWordTimestamps.get(block.index);
          if (!originalTimestamps) continue;
          
          segments.push({
            start: originalTimestamps.start,
            end: originalTimestamps.end
          });
          
          if (i < currentBlocks.length - 1) {
            const nextBlock = currentBlocks[i + 1];
            const nextOriginalTimestamps = originalWordTimestamps.get(nextBlock.index);
            if (nextOriginalTimestamps) {
              const originalGap = nextOriginalTimestamps.start - originalTimestamps.end;
              if (originalGap > 0) {
                segments.push({
                  start: originalTimestamps.end,
                  end: nextOriginalTimestamps.start
                });
              }
            }
          }
        }
        
        if (segments.length > 0) {
          await editDocumentAudio(documentPath, segments);
          window.location.reload(); // Reload to get updated audio
        }
      } catch (error) {
        console.error("Failed to update audio after redo:", error);
        setTranscriptionError("Failed to update audio file after redo");
      }
    }
  }, [canRedo, historyIndex, history, currentTranscription, transcription, onTranscriptionUpdate, documentPath, originalWordTimestamps]);

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

    // CRITICAL: Always use originalIndex from word object, fallback to index only if not set
    // This ensures deleted words can be correctly identified in preview/save
    const blocks = currentTranscription.words.map((word, index) => {
      // originalIndex should always be set - it's set on initial load and preserved during edits
      const originalIndex = (word as any).originalIndex !== undefined 
        ? (word as any).originalIndex 
        : index; // Fallback if somehow missing
      
      return {
        id: `word-${index}-${word.start}-${word.end}`,
        word: word.word.trim(),
        start: word.start,
        end: word.end,
        index: originalIndex,
        deleted: (word as any).deleted || false
      } as WordBlock & { deleted: boolean };
    });
    
    console.log("wordBlocks recomputed:", blocks.length, "blocks:", blocks.map(b => b.word).join(" "));
    console.log("wordBlocks originalIndices:", blocks.map(b => ({ word: b.word, originalIndex: b.index })));
    
    return blocks;
  }, [currentTranscription?.words, currentTranscription?.text]);

  // Detect retakes (repeated sequences of words that are close together)
  const retakeWordIds = useMemo<Set<string>>(() => {
    const retakes = new Set<string>();
    if (wordBlocks.length < 8) return retakes; // Need at least 4 words * 2 sequences = 8 words

    const MAX_DISTANCE = 15; // Maximum words apart to consider as retake

    // Only check sequences of length 4 or more (greater than 3)
    for (let sequenceLength = 4; sequenceLength <= 7; sequenceLength++) {
      for (let i = 0; i < wordBlocks.length - sequenceLength * 2 + 1; i++) {
        // Get the first sequence
        const firstSequence = wordBlocks
          .slice(i, i + sequenceLength)
          .map(block => block.word.toLowerCase().trim());
        
        // Check if sequence has valid words
        if (firstSequence.some(word => word.length === 0)) continue;
        
        // Look for the same sequence starting later, but only within MAX_DISTANCE words
        const searchStart = i + sequenceLength;
        const searchEnd = Math.min(i + MAX_DISTANCE, wordBlocks.length - sequenceLength);
        
        for (let j = searchStart; j <= searchEnd; j++) {
          const secondSequence = wordBlocks
            .slice(j, j + sequenceLength)
            .map(block => block.word.toLowerCase().trim());
          
          // Check if sequences match
          if (firstSequence.join(" ") === secondSequence.join(" ")) {
            // Mark all words in both sequences as retakes
            for (let k = 0; k < sequenceLength; k++) {
              retakes.add(wordBlocks[i + k].id);
              retakes.add(wordBlocks[j + k].id);
            }
            
            // Skip ahead after finding a match to avoid redundant checks
            break;
          }
        }
      }
    }

    return retakes;
  }, [wordBlocks]);

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
      console.log("Line break detection: No documentContent or wordBlocks", { documentContent: !!documentContent, wordBlocksLength: wordBlocks.length });
      return new Set();
    }

    const breaks = new Set<number>();
    const docLines = documentContent.split('\n').filter(line => line.trim().length > 0);
    
    console.log("Line break detection: docLines count", docLines.length, "wordBlocks count", wordBlocks.length);
    
    if (docLines.length <= 1) {
      console.log("Line break detection: Only one line, no breaks");
      return breaks; // No line breaks if document has only one line
    }
    
    // Normalize words: remove punctuation and convert to lowercase
    const normalizeWord = (word: string) => word.toLowerCase().replace(/[.,!?;:—–\-"'()]/g, '').trim();
    
    // Build a map of document words to their line numbers
    const docWordLines: Array<{ word: string; lineIndex: number; wordIndex: number }> = [];
    docLines.forEach((line, lineIdx) => {
      const words = line.split(/\s+/).map(normalizeWord).filter(w => w.length > 0);
      words.forEach((word, wordIdx) => {
        docWordLines.push({ word, lineIndex: lineIdx, wordIndex: wordIdx });
      });
    });
    
    if (docWordLines.length === 0) return breaks;
    
    // Match transcription words to document words
    let docWordIndex = 0;
    let transcriptionWordIndex = 0;
    
    while (transcriptionWordIndex < wordBlocks.length && docWordIndex < docWordLines.length) {
      const transcriptionWord = normalizeWord(wordBlocks[transcriptionWordIndex].word);
      const docWord = docWordLines[docWordIndex].word;
      
      if (transcriptionWord === docWord) {
        // Words match - check if we're at the end of a line in the document
        const currentLineIndex = docWordLines[docWordIndex].lineIndex;
        const isLastWordInLine = docWordIndex === docWordLines.length - 1 || 
                                 docWordLines[docWordIndex + 1].lineIndex !== currentLineIndex;
        
        if (isLastWordInLine && transcriptionWordIndex < wordBlocks.length - 1) {
          // This is the last word of a line in the document, add a break after it
          breaks.add(transcriptionWordIndex);
          console.log(`Line break detected at word index ${transcriptionWordIndex} (word: "${wordBlocks[transcriptionWordIndex].word}")`);
        }
        
        docWordIndex++;
        transcriptionWordIndex++;
      } else {
        // Words don't match - try to find the transcription word in the document
        // This handles cases where transcription has extra words or different punctuation
        const foundInDoc = docWordLines.findIndex((dw, idx) => 
          idx >= docWordIndex && dw.word === transcriptionWord
        );
        
        if (foundInDoc >= 0) {
          // Found it later in the document, skip ahead
          docWordIndex = foundInDoc + 1;
          transcriptionWordIndex++;
        } else {
          // Transcription word not found, skip it
          transcriptionWordIndex++;
        }
      }
    }
    
    console.log("Line break detection: Final breaks", Array.from(breaks));
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
    if (!currentTranscription) return;

    // Map block IDs to word indices
    const blockIdToWordIndex = new Map<string, number>();
    wordBlocks.forEach((block, index) => {
      blockIdToWordIndex.set(block.id, index);
    });

    // Get indices of words to mark as deleted
    const wordIndicesToDelete = new Set<number>();
    selectedWordIds.forEach(blockId => {
      const wordIndex = blockIdToWordIndex.get(blockId);
      if (wordIndex !== undefined) {
        wordIndicesToDelete.add(wordIndex);
      }
    });

    // Mark words as deleted instead of removing them
    const updatedWords = currentTranscription.words.map((word, index) => {
      if (wordIndicesToDelete.has(index)) {
        return {
          ...word,
          deleted: true,
          originalIndex: (word as any).originalIndex !== undefined 
            ? (word as any).originalIndex 
            : index
        } as any;
      }
      return word;
    });

    // Check if all words would be deleted
    const nonDeletedWords = updatedWords.filter((w: any) => !w.deleted);
    if (nonDeletedWords.length === 0) {
      setTranscriptionError("Cannot delete all words");
      return;
    }

    // Update transcription - keep all words but mark some as deleted
    const updated: Transcription = {
      ...currentTranscription,
      words: updatedWords as any,
      text: nonDeletedWords.map((w: any) => w.word).join(" ")
    };

    // Save to history
    const state: TranscriptionState = {
      words: updated.words.map((w) => ({
        ...w,
        originalIndex: (w as any).originalIndex,
        deleted: (w as any).deleted || false
      })) as any,
      text: updated.text,
      segments: updated.segments || [],
      language: updated.language,
      duration: updated.duration
    };
    saveToHistory(state);

    // Update state
    setCurrentTranscription(updated);
    setSelectedWordIds(new Set());
    setSelectedPauseIds(new Set());
    onTranscriptionUpdate?.(updated);
    setTranscriptionError(null);
  }, [selectedWordIds, selectedPauseIds, wordBlocks, currentTranscription, onTranscriptionUpdate, saveToHistory]);

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
        words: newWords.map((block) => {
          // Get the original word object from the current transcription
          // block.index is the original index in the original transcription
          const originalWord = currentTranscription!.words.find((w, idx) => {
            const wordOriginalIndex = (w as any).originalIndex !== undefined ? (w as any).originalIndex : idx;
            return wordOriginalIndex === block.index;
          });
          
          if (!originalWord) {
            console.error("Pause Adjust: Could not find original word for block:", block);
            return {
              word: block.word,
              start: block.start,
              end: block.end,
              originalIndex: block.index
            } as any;
          }
          
          return {
            ...originalWord,
            word: block.word,
            start: block.start,
            end: block.end,
            originalIndex: block.index // Preserve the original index
          } as any;
        }),
        text: newWords.map((block) => block.word).join(" "),
        segments: currentTranscription?.segments || []
      };

      // Save to history - CRITICAL: Preserve originalIndex in history so undo/redo works correctly
      const state: TranscriptionState = {
        words: updated.words.map((w) => ({
          ...w,
          originalIndex: (w as any).originalIndex // Explicitly preserve originalIndex
        })) as any,
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

  const pauseTimeoutRef = useRef<number | null>(null);

  const handleStopPreview = useCallback(() => {
    console.log("Stopping preview...");
    
    // Set preview flag to false immediately (using ref for immediate access in callbacks)
    isPreviewingRef.current = false;
    
    // Stop audio source immediately
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
        previewSourceRef.current.disconnect();
      } catch (error) {
        console.warn("Error stopping audio source:", error);
      }
      previewSourceRef.current = null;
    }
    
    // Clear animation frame
    if (playbackAnimationFrameRef.current) {
      cancelAnimationFrame(playbackAnimationFrameRef.current);
      playbackAnimationFrameRef.current = null;
    }
    
    // Clear pause timeout
    if (pauseTimeoutRef.current !== null) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
    
    // Reset playback state
    playbackStartTimeRef.current = null;
    playbackBlocksRef.current = [];
    setCurrentPlayingWordId(null);
    setIsPreviewing(false);
    
    console.log("Preview stopped");
  }, []);

  const handlePreview = useCallback(async () => {
    if (isPreviewing) {
      // If already previewing, stop it
      handleStopPreview();
      return;
    }

    if (!audioBufferRef.current || !audioContextRef.current || !currentTranscription) {
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

    isPreviewingRef.current = true;
    setIsPreviewing(true);
    setTranscriptionError(null);

    try {
      // SIMPLE APPROACH: Use currentTranscription.words directly - exclude deleted words
      if (!currentTranscription || !currentTranscription.words || currentTranscription.words.length === 0) {
        setTranscriptionError("No words to preview");
        setIsPreviewing(false);
        return;
      }

      // Build list of words to play from currentTranscription.words
      // Only include words that have valid originalIndex, original timestamps, and are not deleted
      const wordsToPlay: Array<{
        word: any;
        originalIndex: number;
        originalStart: number;
        originalEnd: number;
      }> = [];

      for (const word of currentTranscription.words) {
        // Skip deleted words
        if ((word as any).deleted) {
          continue;
        }

        const originalIndex = (word as any).originalIndex;
        if (originalIndex === undefined || originalIndex === null) {
          continue; // Skip words without originalIndex
        }

        const originalTimestamps = originalWordTimestamps.get(originalIndex);
        if (!originalTimestamps) {
          continue; // Skip words without original timestamps
        }

        // Validate timestamps are within audio buffer
        const sampleRate = audioBuffer.sampleRate;
        const originalStartSample = Math.floor(originalTimestamps.start * sampleRate);
        const originalEndSample = Math.floor(originalTimestamps.end * sampleRate);
        if (originalStartSample < 0 || originalEndSample > audioBuffer.length || originalEndSample <= originalStartSample) {
          continue; // Skip invalid timestamps
        }

        wordsToPlay.push({
          word,
          originalIndex,
          originalStart: originalTimestamps.start,
          originalEnd: originalTimestamps.end
        });
      }

      if (wordsToPlay.length === 0) {
        setTranscriptionError("No valid words to preview");
        setIsPreviewing(false);
        return;
      }

      // If words are selected, start from first selected word
      let startIndex = 0;
      if (selectedWordIds.size > 0) {
        const blockIdToIndex = new Map<string, number>();
        wordBlocks.forEach((block, idx) => {
          blockIdToIndex.set(block.id, idx);
        });

        const firstSelectedBlockId = Array.from(selectedWordIds)[0];
        const firstSelectedBlockIndex = blockIdToIndex.get(firstSelectedBlockId);
        if (firstSelectedBlockIndex !== undefined) {
          // Find this word in wordsToPlay by matching originalIndex
          const selectedOriginalIndex = wordBlocks[firstSelectedBlockIndex]?.index;
          if (selectedOriginalIndex !== undefined) {
            const foundIndex = wordsToPlay.findIndex(w => w.originalIndex === selectedOriginalIndex);
            if (foundIndex >= 0) {
              startIndex = foundIndex;
            }
          }
        }
      }

      const blocksToPlay = wordsToPlay.slice(startIndex);

      // Build playback timeline with pauses
      // Each item is either a word or a pause
      // Use wordBlocks to get current adjusted timestamps, but original audio for playback
      type PlaybackItem = 
        | { type: 'word'; wordIndex: number; item: typeof wordsToPlay[0]; originalStart: number; originalEnd: number; adjustedStart: number; adjustedEnd: number; startTime: number; endTime: number; id: string }
        | { type: 'pause'; duration: number; startTime: number; endTime: number; id: string };
      
      const playbackTimeline: PlaybackItem[] = [];
      let currentTime = 0;
      
      for (let i = 0; i < blocksToPlay.length; i++) {
        const item = blocksToPlay[i];
        
        // Find the matching word block to get adjusted timestamps
        const matchingWordBlock = wordBlocks.find(b => b.index === item.originalIndex);
        if (!matchingWordBlock) continue;
        
        // Use original audio timestamps for playback (to avoid cutting)
        const originalStart = item.originalStart;
        const originalEnd = item.originalEnd;
        
        // Use adjusted timestamps from wordBlocks for timeline positioning
        const adjustedStart = matchingWordBlock.start;
        const adjustedEnd = matchingWordBlock.end;
        
        // Check if this word comes after a pause - if so, we'll start earlier to avoid cutting
        const prevItem = i > 0 ? blocksToPlay[i - 1] : null;
        const prevWordBlock = prevItem ? wordBlocks.find(b => b.index === prevItem.originalIndex) : null;
        const comesAfterPause = prevWordBlock ? (adjustedStart - prevWordBlock.end > pauseThreshold) : false;
        
        // Calculate word duration - will be extended if we start earlier
        const earlyStartOffset = comesAfterPause ? 0.15 : 0.05; // 150ms after pause, 50ms normally
        const adjustedOriginalStart = Math.max(0, originalStart - earlyStartOffset);
        const wordDuration = originalEnd - adjustedOriginalStart;
        
        // Calculate the actual gap before this word (if it's after a pause adjustment)
        let gapBeforeWord = 0;
        if (i > 0 && prevWordBlock) {
          // The gap is the difference between adjusted timestamps
          const adjustedGap = adjustedStart - prevWordBlock.end;
          if (adjustedGap > 0) {
            gapBeforeWord = adjustedGap;
          }
        }
        
        // Timeline position: Start playback slightly earlier if coming after pause
        // This ensures the early audio plays at the right time
        const wordStartTime = currentTime + gapBeforeWord - earlyStartOffset;
        const wordEndTime = wordStartTime + wordDuration;
        
        const wordId = matchingWordBlock.id;
        playbackTimeline.push({
          type: 'word',
          wordIndex: i,
          item,
          originalStart,
          originalEnd,
          adjustedStart,
          adjustedEnd,
          startTime: wordStartTime,
          endTime: wordEndTime,
          id: wordId
        });
        
        currentTime = wordEndTime;
        
        // Check for pause after this word (except last)
        if (i < blocksToPlay.length - 1) {
          const nextItem = blocksToPlay[i + 1];
          const nextWordBlock = wordBlocks.find(b => b.index === nextItem.originalIndex);
          
          if (nextWordBlock) {
            // Calculate actual gap from adjusted word positions
            const actualGap = nextWordBlock.start - matchingWordBlock.end;
            
            if (actualGap > pauseThreshold) {
              // Add pause to timeline using the actual adjusted gap
              const pauseStartTime = currentTime;
              const pauseEndTime = currentTime + actualGap;
              console.log(`Adding pause to timeline: ${actualGap.toFixed(3)}s between word ${i} and ${i + 1}`);
              playbackTimeline.push({
                type: 'pause',
                duration: actualGap,
                startTime: pauseStartTime,
                endTime: pauseEndTime,
                id: `pause-${i}`
              });
              currentTime = pauseEndTime;
            } else if (actualGap > 0.01) {
              // Small gap - add minimal pause (not added to timeline, just advance time)
              currentTime += Math.max(0.01, actualGap);
            } else {
              // No gap - minimal spacing
              currentTime += 0.01;
            }
          } else {
            // Minimal gap if we can't find next word
            currentTime += 0.01;
          }
        }
      }
      
      // Store timeline for tracking
      playbackBlocksRef.current = playbackTimeline.map(item => ({
        id: item.id,
        start: item.startTime,
        end: item.endTime
      }));
      
      console.log(`Playback timeline created with ${playbackTimeline.length} items:`, 
        playbackTimeline.map(item => item.type === 'pause' ? `pause(${item.duration.toFixed(2)}s)` : 'word'));
      
      // Play words and pauses sequentially
      let currentItemIndex = 0;
      
      const playNextItem = () => {
        // Check if preview was stopped (use ref for reliable check)
        if (!isPreviewingRef.current) {
          console.log("Preview stopped, aborting playback");
          return;
        }
        
        if (currentItemIndex >= playbackTimeline.length) {
          handleStopPreview();
          return;
        }
        
        const item = playbackTimeline[currentItemIndex];
        
        if (item.type === 'word') {
          // Check if this word comes after a pause - if so, start slightly earlier to avoid cutting
          const previousItem = currentItemIndex > 0 ? playbackTimeline[currentItemIndex - 1] : null;
          const comesAfterPause = previousItem?.type === 'pause';
          
          // Start 150ms earlier if coming after a pause to ensure full word is audible
          // 50ms earlier normally for safety margin
          const earlyStartOffset = comesAfterPause ? 0.15 : 0.05;
          const adjustedOriginalStart = Math.max(0, item.originalStart - earlyStartOffset);
          const wordDuration = item.originalEnd - adjustedOriginalStart;
          
          const wordBuffer = audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            Math.ceil(wordDuration * audioBuffer.sampleRate),
            audioBuffer.sampleRate
          );
          
          const originalStartSample = Math.floor(adjustedOriginalStart * audioBuffer.sampleRate);
          const originalEndSample = Math.floor(item.originalEnd * audioBuffer.sampleRate);
          const samplesToCopy = originalEndSample - originalStartSample;
          
          // Copy word audio from original buffer, starting from earlier position
          // This ensures we capture the full beginning of the word
          for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const originalData = audioBuffer.getChannelData(channel);
            const newData = wordBuffer.getChannelData(channel);
            const maxSamples = Math.min(samplesToCopy, newData.length, originalData.length - originalStartSample);
            
            // Copy audio samples starting from the earlier position
            for (let j = 0; j < maxSamples; j++) {
              const sourceIndex = originalStartSample + j;
              if (sourceIndex >= 0 && sourceIndex < originalData.length && j < newData.length) {
                newData[j] = originalData[sourceIndex];
              }
            }
          }
          
          const source = audioContext.createBufferSource();
          source.buffer = wordBuffer;
          source.connect(audioContext.destination);
          previewSourceRef.current = source;
          
          // Track current word
          setCurrentPlayingWordId(item.id);
          
          // Scroll to word
          if (containerRef.current) {
            const wordElement = containerRef.current.querySelector(`[data-word-id="${item.id}"]`) as HTMLElement;
            if (wordElement) {
              requestAnimationFrame(() => {
                wordElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              });
            }
          }
          
          // Calculate actual play duration (may be longer if we started earlier)
          const actualPlayDuration = wordBuffer.duration;
          
          source.onended = () => {
            // Check if preview was stopped before continuing (use ref for reliable check)
            if (!isPreviewingRef.current) {
              return;
            }
            
            // Clear current word highlight when word ends
            setCurrentPlayingWordId(null);
            // Move to next item
            currentItemIndex++;
            // Use setTimeout to ensure smooth transition
            setTimeout(() => {
              if (isPreviewingRef.current) {
                playNextItem();
              }
            }, 10);
          };
          
          source.start(0);
        } else if (item.type === 'pause') {
          // Pause playback - clear current word highlight
          setCurrentPlayingWordId(null);
          
          // Stop current source if playing
          if (previewSourceRef.current) {
            try {
              previewSourceRef.current.stop();
            } catch {}
            previewSourceRef.current = null;
          }
          
          // Wait for pause duration, then continue to next word
          const pauseDurationMs = Math.max(50, Math.round(item.duration * 1000)); // Minimum 50ms, round to avoid precision issues
          console.log(`Playing pause: ${pauseDurationMs}ms (${item.duration.toFixed(3)}s)`);
          pauseTimeoutRef.current = window.setTimeout(() => {
            // Check if preview was stopped before continuing (use ref for reliable check)
            if (!isPreviewingRef.current) {
              console.log("Preview stopped during pause");
              return;
            }
            
            if (pauseTimeoutRef.current !== null) {
              pauseTimeoutRef.current = null;
              currentItemIndex++;
              playNextItem();
            }
          }, pauseDurationMs);
        }
      };
      
      // Start playback tracking
      playbackStartTimeRef.current = audioContext.currentTime;
      
      // Start playing
      playNextItem();
    } catch (error) {
      console.error("Preview error:", error);
      setTranscriptionError("Failed to preview audio: " + (error instanceof Error ? error.message : "Unknown error"));
      setIsPreviewing(false);
    }
  }, [currentTranscription, selectedWordIds, isPreviewing, handleStopPreview, originalWordTimestamps, wordBlocks, pauses, pauseThreshold]);

  const handleAiStudioSound = useCallback(async () => {
    if (!documentPath || !audioUrl) {
      setTranscriptionError("No audio file available");
      return;
    }

    setIsApplyingAiSound(true);
    setTranscriptionError(null);

    try {
      // Use FFmpeg-based professional audio enhancement
      console.log("Starting Studio Sound enhancement...");
      const result = await enhanceDocumentAudio(documentPath);
      if (result.audioUrl) {
        // Reload to get the enhanced audio
        window.location.reload();
      }
    } catch (error: any) {
      console.error("Audio enhancement error:", error);
      const message =
        error instanceof Error
          ? error.message
          : error?.error || error?.message || "Failed to enhance audio";
      setTranscriptionError(message);
    } finally {
      setIsApplyingAiSound(false);
    }
  }, [documentPath, audioUrl]);

  const handleExportMp3 = useCallback(async () => {
    if (!documentPath || !audioUrl) {
      setTranscriptionError("No audio file available");
      return;
    }

    setIsExportingMp3(true);
    setTranscriptionError(null);

    try {
      await exportAudioAsMp3(documentPath);
    } catch (error: any) {
      console.error("MP3 export error:", error);
      const message =
        error instanceof Error
          ? error.message
          : error?.error || error?.message || "Failed to export audio as MP3";
      setTranscriptionError(message);
    } finally {
      setIsExportingMp3(false);
    }
  }, [documentPath, audioUrl]);

  const handleSaveEdits = useCallback(async () => {
    if (!currentTranscription) return;

    // CRITICAL: Use currentTranscription.words directly - exclude deleted words
    const nonDeletedWords = currentTranscription.words.filter((w: any) => !w.deleted);
    console.log("Save Edits: currentTranscription.words count", currentTranscription.words.length);
    console.log("Save Edits: non-deleted words count", nonDeletedWords.length);
    console.log("Save Edits: currentTranscription.words text", nonDeletedWords.map((w: any) => w.word).join(" "));
    console.log("Save Edits: currentTranscription words with originalIndex", nonDeletedWords.map((w: any, i: number) => ({
      index: i,
      word: w.word,
      originalIndex: (w as any).originalIndex
    })));
    
    // Create blocks from non-deleted words only
    const currentBlocks = nonDeletedWords.map((word: any, currentIndex: number) => {
      // originalIndex should always be set - it's set on initial load and preserved during edits
      const originalIndex = (word as any).originalIndex !== undefined 
        ? (word as any).originalIndex 
        : currentIndex; // Fallback if somehow missing
      return {
        id: `word-${currentIndex}-${word.start}-${word.end}`,
        word: word.word.trim(),
        start: word.start,
        end: word.end,
        index: originalIndex // Use original index to map back to original audio
      };
    });

    console.log("Save Edits: Processing", currentBlocks.length, "words (deleted words should already be excluded)");
    console.log("Save Edits: Words to export:", currentBlocks.map(b => b.word).join(" "));
    
    // Create segments using ORIGINAL timestamps (for cutting from original audio)
    const segments: Array<{ start: number; end: number }> = [];
    
    for (let i = 0; i < currentBlocks.length; i++) {
      const block = currentBlocks[i];
      
      // Get original timestamps for this word
      const originalTimestamps = originalWordTimestamps.get(block.index);
      if (!originalTimestamps) {
        console.warn("Save Edits: Skipping word - could not find original timestamps:", block.index, block.word);
        continue; // Skip if we can't find original timestamps
      }
      
      console.log(`Save Edits: Adding word "${block.word}" with original timestamps ${originalTimestamps.start}-${originalTimestamps.end}`);
      
      // Add the word segment using original timestamps
      segments.push({
        start: originalTimestamps.start,
        end: originalTimestamps.end
      });
      
      // Add pause segment after this word (except the last)
      if (i < currentBlocks.length - 1) {
        const nextBlock = currentBlocks[i + 1];
        const nextOriginalTimestamps = originalWordTimestamps.get(nextBlock.index);
        
        if (nextOriginalTimestamps) {
          const originalGap = nextOriginalTimestamps.start - originalTimestamps.end;
          const adjustedGap = nextBlock.start - block.end;
          
          if (originalGap > 0 && adjustedGap > 0) {
            // Use original gap for cutting, but adjusted gap for duration
            // For now, we'll copy the original pause, and the server can adjust duration
            segments.push({
              start: originalTimestamps.end,
              end: nextOriginalTimestamps.start
            });
          } else if (adjustedGap > 0) {
            // No original gap, but adjusted gap exists - create silence segment
            // We'll handle this on the server side with the adjusted duration
            segments.push({
              start: originalTimestamps.end,
              end: originalTimestamps.end + adjustedGap
            });
          }
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
  }, [currentTranscription, documentPath, originalWordTimestamps]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const formattedRecordingTime = useMemo(() => {
    const mins = Math.floor(recordingElapsed / 60);
    const secs = Math.floor(recordingElapsed % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, [recordingElapsed]);

  const hasTranscription = Boolean(currentTranscription);
  const duration = currentTranscription?.duration || 0;

  return (
    <div className="audio-editor">
      {transcriptionError && (
        <div className="audio-editor-error">{transcriptionError}</div>
      )}

      {/* Unified Controls Panel - Recording at top, Editing at bottom */}
      <div className="audio-editor-unified-panel">
        {/* Recording Section - Top */}
        <div className="audio-editor-recording-section">
          <div className="audio-editor-recording-header">
            <span className="audio-editor-recording-label">Recording</span>
            {isRecordingAudio && (
              <span className="audio-editor-recording-status recording">
                {formattedRecordingTime}
              </span>
            )}
            {!isRecordingAudio && hasAudio && (
              <span className="audio-editor-recording-status ready">Ready</span>
            )}
          </div>
          <div className="audio-editor-recording-controls">
            <button
              className="audio-editor-icon-button"
              onClick={() => onStartRecording?.()}
              disabled={!canStartRecording}
              title="Start recording (Ctrl/Cmd + R)"
            >
              <IconRecord className="audio-editor-icon" />
            </button>
            <button
              className="audio-editor-icon-button"
              onClick={() => onStopRecording?.()}
              disabled={!isRecordingAudio}
              title="Stop recording"
            >
              <IconStop className="audio-editor-icon" />
            </button>
            <button
              className="audio-editor-icon-button"
              onClick={() => onPlayAudio?.()}
              disabled={!hasAudio || isRecordingAudio}
              title="Play audio"
            >
              <IconPlay className="audio-editor-icon" />
            </button>
            <button
              className="audio-editor-icon-button"
              onClick={() => onPauseAudio?.()}
              disabled={!hasAudio}
              title="Pause audio"
            >
              <IconPause className="audio-editor-icon" />
            </button>
            <button
              className="audio-editor-icon-button"
              onClick={() => onRewindAudio?.()}
              disabled={!hasAudio}
              title="Rewind to beginning"
            >
              <IconRewind className="audio-editor-icon" />
            </button>
          </div>
          {recordingFileName && !isRecordingAudio && (
            <div className="audio-editor-recording-filename">
              {recordingFileName}
            </div>
          )}
        </div>

        {/* Editing Section - Bottom */}
        {(hasTranscription || audioUrl) && (
          <>
            <div className="audio-editor-section-divider" />
            <div className="audio-editor-editing-section">
              <h2 className="audio-editor-title">Audio Editing</h2>
              {!hasTranscription && audioUrl && (
                <div className="audio-editor-message-inline">
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
                <div className="audio-editor-controls-grid">
                  {/* First row of icons */}
                  <div className="audio-editor-controls-row">
                    <button
                      className="audio-editor-icon-button"
                      onClick={handleUndo}
                      disabled={!canUndo}
                      title="Undo (Ctrl/Cmd + Z)"
                    >
                      <svg className="audio-editor-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7v6h6" />
                        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                      </svg>
                    </button>
                    <button
                      className="audio-editor-icon-button"
                      onClick={handleRedo}
                      disabled={!canRedo}
                      title="Redo (Ctrl/Cmd + Shift + Z)"
                    >
                      <svg className="audio-editor-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 7v6h-6" />
                        <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
                      </svg>
                    </button>
                    <button
                      className="audio-editor-icon-button"
                      onClick={isPreviewing ? handleStopPreview : handlePreview}
                      disabled={wordBlocks.length === 0}
                      title={isPreviewing ? "Stop preview" : "Preview edited audio"}
                    >
                      {isPreviewing ? <IconPause className="audio-editor-icon" /> : <IconPlay className="audio-editor-icon" />}
                    </button>
                    <button
                      className="audio-editor-icon-button"
                      onClick={handleTranscribe}
                      disabled={isTranscribing || !audioUrl}
                      title="Reset all edits and re-transcribe from original audio"
                    >
                      <svg className="audio-editor-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                        <path d="M3 21v-5h5" />
                      </svg>
                    </button>
                    <button
                      className="audio-editor-icon-button"
                      onClick={handleSaveEdits}
                      disabled={isApplyingEdits}
                      title={isApplyingEdits ? "Saving..." : "Save audio edits to file"}
                    >
                      <svg className="audio-editor-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                        <polyline points="7 3 7 8 15 8" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Second row of icons */}
                  <div className="audio-editor-controls-row">
                    <button
                      className="audio-editor-icon-button"
                      onClick={handleAiStudioSound}
                      disabled={isApplyingAiSound || !audioUrl}
                      title="Professional audio enhancement: noise reduction, EQ, compression, and normalization"
                    >
                      <svg className="audio-editor-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v20" />
                        <path d="M2 12h20" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    <button
                      className="audio-editor-icon-button"
                      onClick={handleExportMp3}
                      disabled={isExportingMp3 || !audioUrl}
                      title="Export audio as MP3 file"
                    >
                      <svg className="audio-editor-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </button>
                    <label className="audio-editor-pause-threshold-inline">
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)", marginRight: "8px" }}>Pause threshold:</span>
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
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)", marginLeft: "4px" }}>s</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {!audioUrl && !isRecordingAudio && (
        <div className="audio-editor-message">
          Record audio to get started.
        </div>
      )}

      {hasTranscription && (
        <>
          <div className="audio-editor-words-wrapper">
            <div 
              ref={containerRef}
              className="audio-editor-words-container"
              onMouseUp={handleWordMouseUp}
            >
            {wordBlocks.map((block, index) => {
              const isSelected = selectedWordIds.has(block.id);
              const isRetake = retakeWordIds.has(block.id);
              const isCurrentlyPlaying = currentPlayingWordId === block.id;
              const isDeleted = (block as any).deleted || false;
              const nextBlock = wordBlocks[index + 1];
              // Find pause after this word
              const pauseAfter = pauses.find(
                (p) => p.beforeWordIndex === index
              ) || null;
              const isPauseSelected = pauseAfter && selectedPauseIds.has(pauseAfter.id);
              // Line break for document line breaks (always) OR long pauses
              const shouldBreakLine = (index < wordBlocks.length - 1 && lineBreakIndicesSimple.has(index)) ||
                                     (pauseAfter && pauseAfter.duration >= 1.0);

              return (
                <React.Fragment key={block.id}>
                  <button
                    type="button"
                    data-word-id={block.id}
                    className={clsx("audio-editor-word-block", {
                      "audio-editor-word-selected": isSelected,
                      "audio-editor-word-retake": isRetake,
                      "audio-editor-word-current": isCurrentlyPlaying
                    })}
                    style={isDeleted ? { opacity: 0.2 } : undefined}
                    onMouseDown={(e) => handleWordMouseDown(block.id, e)}
                    onMouseEnter={() => handleWordMouseEnter(block.id)}
                    title={`${formatTime(block.start)} - ${formatTime(block.end)}${isRetake ? " (Retake)" : ""}${isDeleted ? " (Deleted)" : ""}`}
                  >
                    {block.word}
                  </button>
                  {pauseAfter && (
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
                  )}
                  {shouldBreakLine && <div className="audio-editor-line-break" />}
                </React.Fragment>
              );
            })}
            </div>
          </div>

          <audio ref={audioRef} src={audioUrl || undefined} style={{ display: "none" }} />
        </>
      )}
    </div>
  );
}

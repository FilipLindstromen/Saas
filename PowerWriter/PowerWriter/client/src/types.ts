export type TreeNode = {
  type: "folder" | "document";
  name: string;
  path: string;
  instructions?: string | null;
  color?: string | null;
  children?: TreeNode[];
  completed?: boolean;
};

export type FolderDetails = {
  path: string;
  name: string;
  instructions: string;
  aggregatedInstructions: string;
  color: string | null;
};

export type WordTimestamp = {
  word: string;
  start: number;
  end: number;
  recordingId?: string; // ID of the recording this word came from
};

export type SegmentTimestamp = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

export type Transcription = {
  text: string;
  language: string;
  duration: number;
  words: WordTimestamp[];
  segments: SegmentTimestamp[];
};

export type Recording = {
  id: string;
  audioUrl: string;
  videoUrl?: string | null;
  audioFileName: string;
  videoFileName?: string | null;
  type: "audio" | "audio+video";
  createdAt: number;
  transcription?: Transcription | null;
  color?: string; // Color for word backgrounds from this recording
};

export type DocumentDetails = {
  path: string;
  name: string;
  content: string;
  instructions: string;
  aggregatedInstructions: string;
  completed: boolean;
  audioUrl: string | null; // Legacy - for backward compatibility
  audioFileName: string | null; // Legacy
  videoUrl?: string | null; // Legacy
  recordings?: Recording[]; // New: array of recordings
  transcription: Transcription | null;
};


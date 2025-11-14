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

export type DocumentDetails = {
  path: string;
  name: string;
  content: string;
  instructions: string;
  aggregatedInstructions: string;
  completed: boolean;
  audioUrl: string | null;
  audioFileName: string | null;
  transcription: Transcription | null;
};


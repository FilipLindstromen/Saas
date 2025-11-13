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

export type DocumentDetails = {
  path: string;
  name: string;
  content: string;
  instructions: string;
  aggregatedInstructions: string;
  completed: boolean;
  audioUrl: string | null;
  audioFileName: string | null;
};


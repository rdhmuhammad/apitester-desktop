export interface FileItem {
  id: string;
  path: string;
  title: string;
  folder: string;
  content: string;
  updatedAt: number;
  isDirty?: boolean;
}

export interface FrontmatterData {
  tags?: string[];
  aliases?: string[];
  created?: string;
  status?: string;
  author?: string;
  category?: string;
  publish?: boolean;
  priority?: number;
  [key: string]: any;
}

export interface WikiLinkMatch {
  raw: string;
  target: string;
  subpath?: string; // after #
  alias?: string;   // after |
  isEmbed: boolean; // if starts with !
}

export interface BacklinkMention {
  fileId: string;
  fileTitle: string;
  filePath: string;
  snippet: string;
  lineIndex: number;
}

export interface FileBacklinks {
  linkedMentions: BacklinkMention[];
  unlinkedMentions: BacklinkMention[];
}

export interface EditorTab {
  id: string;
  fileId: string;
}

import type { TimelineEvent } from "../../types/index.ts";

export interface CandidateImage {
  url: string;
  fallbackUrl?: string;
  title: string;
  creator?: string;
  source: string;
  provider: string;
  license?: string;
  width?: number;
  height?: number;
  landingUrl?: string;
}

export interface SourceAdapter {
  name: string;
  fetchCandidates(event: TimelineEvent, options?: SourceOptions): Promise<CandidateImage[]>;
}

export interface SourceOptions {
  maxResults?: number;
  csvIndex?: Map<string, CsvImageRow[]>;
}

export interface CsvImageRow {
  title: string;
  url: string;
  localIdentifier?: string;
  naId?: string;
  objectType?: string;
}

export interface UploadedImage {
  gcsPath: string;
  publicUrl: string;
  candidate: CandidateImage;
}

export interface PipelineOptions {
  topicId: string;
  eventFilter?: string;
  sources: Set<string>;
  maxImages: number;
  dryRun: boolean;
  force: boolean;
  csvPath?: string;
  concurrency: number;
  migrate: boolean;
}

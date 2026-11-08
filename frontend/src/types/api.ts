import type { Sample } from './metrics';

export type SessionCreated = {
  id: string;
  started_at: string;
};

export type SampleBatchResult = {
  received: number;
  inserted: number;
  duplicates: number;
  ignored: number;
};

export type SessionSummary = {
  duration_seconds: number;
  average_fps: number | null;
  face_percent: number | null;
  good_percent: number | null;
  samples_saved: number;
  samples_missing: number | null;
};

export type SessionRecord = {
  id: string;
  started_at: string;
  ended_at: string | null;
  summary: SessionSummary;
};

export type SessionDetail = SessionRecord & {
  samples: Sample[];
};

export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

import type { SessionPhase } from '../types/session';

export const PHASE_LABELS: Record<SessionPhase, string> = {
  idle: 'Ready',
  loading_model: 'Loading face detection…',
  requesting_camera: 'Waiting for camera…',
  creating_session: 'Connecting to server…',
  running: 'Recording',
  paused: 'Paused',
  stopping: 'Saving…',
  error: 'Stopped',
};

export const STARTING_PHASES: readonly SessionPhase[] = [
  'loading_model',
  'requesting_camera',
  'creating_session',
];

export const RECORDING_PHASES: readonly SessionPhase[] = ['running', 'paused'];

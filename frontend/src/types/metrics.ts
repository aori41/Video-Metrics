export type Verdict = 'good' | 'poor';

export type Reason = 'no_face' | 'too_dark' | 'too_bright' | 'hold_still' | 'low_fps';

export type Sample = {
  t: number;
  fps: number;
  brightness: number;
  motion: number;
  face: boolean;
  verdict: Verdict;
  reason: Reason | null;
};

export type Thresholds = {
  fpsMin: number;
  brightnessMin: number;
  brightnessMax: number;
  motionMax: number;
};

export type MeasuredValues = Pick<Sample, 'fps' | 'brightness' | 'motion' | 'face'>;

export type VerdictResult = Pick<Sample, 'verdict' | 'reason'>;

export type FrameMetrics = {
  brightness: number;
  motion: number | null;
};

export type SecondBucket = {
  t: number;
  windowStartMs: number;
  frames: number;
  brightnessTotal: number;
  motionTotal: number;
  motionFrames: number;
  faceAttempts: number;
  faceDetected: boolean;
};

export type BucketAdvance = {
  closed: Sample[];
  bucket: SecondBucket;
};

export type ChartSeries = {
  seconds: number[];
  fps: (number | null)[];
  brightness: (number | null)[];
  motion: (number | null)[];
  face: (boolean | null)[];
  good: (boolean | null)[];
};

export type MetricPanelData = {
  id: string;
  label: string;
  hint: string;
  values: (number | null)[];
  lowerLimit?: number;
  upperLimit?: number;
  softMax: number;
};

export type MetricPlotSettings = Pick<
  MetricPanelData,
  'lowerLimit' | 'upperLimit' | 'softMax'
> & {
  showTimeAxis: boolean;
  onHover: (index: number | null) => void;
};

export type MetricTone = 'idle' | 'ok' | 'bad';

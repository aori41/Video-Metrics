export const CHART_PANEL_HEIGHT = 92;
export const CHART_TIME_AXIS_HEIGHT = 44;
export const CHART_AXIS_WIDTH = 44;
export const CHART_PLOT_TOP_PADDING = 6;
export const CHART_PLOT_BOTTOM_PADDING = 8;
export const CHART_PLOT_LEFT_INSET = CHART_AXIS_WIDTH;
export const CHART_PLOT_RIGHT_INSET = 16;
export const CHART_Y_TICK_SPACE = 24;
export const CHART_SECOND_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
export const CHART_SYNC_KEY = 'session-metrics';

export const CHART_LIMIT_DASH = [6, 4];

// Each panel shows at least this range, so a quiet metric doesn't fill the plot with noise.
export const CHART_SOFT_MAX = {
  fps: 60,
  brightness: 255,
  motion: 60,
};

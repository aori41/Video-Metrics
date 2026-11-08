import { createTheme, DEFAULT_THEME, rgba } from '@mantine/core';

const PRIMARY_COLOR = 'indigo';
const { colors } = DEFAULT_THEME;

export const ICON_SIZES = {
  button: 16,
  card: 18,
  header: 20,
  status: 22,
  placeholder: 36,
};

// The plots draw on a canvas, which needs real colors and cannot read CSS variables.
export const CHART_COLORS = {
  axis: colors.gray[6],
  grid: rgba(colors.gray[6], 0.2),
  line: colors[PRIMARY_COLOR][6],
  limit: colors.red[6],
  outOfLimitFill: rgba(colors.red[6], 0.08),
};

export const STATUS_STRIP_COLORS = {
  ok: 'var(--mantine-color-teal-6)',
  bad: 'var(--mantine-color-red-6)',
  empty: 'var(--mantine-color-default-border)',
};

export const theme = createTheme({
  primaryColor: PRIMARY_COLOR,
  defaultRadius: 'md',
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: { fontWeight: '600' },
});

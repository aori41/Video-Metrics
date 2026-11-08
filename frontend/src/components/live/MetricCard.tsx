import { Group, Paper, Text, ThemeIcon } from '@mantine/core';
import React, { memo, type ReactNode } from 'react';
import type { MetricTone } from '../../types/metrics';

type Props = {
  label: string;
  value: string;
  hint: string;
  tone: MetricTone;
  icon: ReactNode;
};

const TONE_COLORS: Record<MetricTone, string> = {
  idle: 'gray',
  ok: 'teal',
  bad: 'red',
};

const MetricCard: React.FC<Props> = ({ label, value, hint, tone, icon }) => (
  <Paper withBorder p="md" radius="md">
    <Group justify="space-between" align="flex-start" wrap="nowrap">
      <div>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          {label}
        </Text>
        <Text size="xl" fw={700} c={tone === 'bad' ? 'red' : undefined}>
          {value}
        </Text>
      </div>
      <ThemeIcon variant="light" color={TONE_COLORS[tone]} size="lg">
        {icon}
      </ThemeIcon>
    </Group>
    <Text size="xs" c="dimmed" mt={4}>
      {hint}
    </Text>
  </Paper>
);

export default memo(MetricCard);

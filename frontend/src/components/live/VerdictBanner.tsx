import { Group, Paper, Text, ThemeIcon } from '@mantine/core';
import { IconCheck, IconClock, IconX } from '@tabler/icons-react';
import React, { memo } from 'react';
import { REASON_LABELS } from '../../domain/verdict';
import { ICON_SIZES } from '../../theme';
import type { Sample } from '../../types/metrics';
import type { SessionPhase } from '../../types/session';

type Props = {
  latest: Sample | null;
  phase: SessionPhase;
};

const VerdictBanner: React.FC<Props> = ({ latest, phase }) => {
  const isLive = phase === 'running' && latest !== null;
  const isGood = isLive && latest.verdict === 'good';
  const color = !isLive ? 'gray' : isGood ? 'teal' : 'red';

  const title = !isLive
    ? phase === 'paused'
      ? 'Paused'
      : 'Waiting for data'
    : isGood
      ? 'Good'
      : `Poor: ${latest.reason ? REASON_LABELS[latest.reason].toLowerCase() : 'unknown'}`;

  return (
    <Paper withBorder p="md" radius="md" role="status" aria-live="polite">
      <Group gap="sm">
        <ThemeIcon size="xl" radius="xl" color={color} variant="light">
          {!isLive ? <IconClock size={ICON_SIZES.status} /> : isGood ? <IconCheck size={ICON_SIZES.status} /> : <IconX size={ICON_SIZES.status} />}
        </ThemeIcon>
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Verdict
          </Text>
          <Text size="xl" fw={700} c={isLive ? color : undefined}>
            {title}
          </Text>
        </div>
      </Group>
    </Paper>
  );
};

export default memo(VerdictBanner);

import { SimpleGrid } from '@mantine/core';
import { IconBolt, IconCircleCheck, IconClock, IconUser } from '@tabler/icons-react';
import React, { memo } from 'react';
import { ICON_SIZES } from '../../theme';
import type { SessionSummary } from '../../types/api';
import { formatDecimal, formatDuration } from '../../utils/formatters';
import MetricCard from '../live/MetricCard';

type Props = {
  summary: SessionSummary;
};

const SessionSummaryGrid: React.FC<Props> = ({ summary }) => (
  <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
    <MetricCard
      label="Duration"
      value={formatDuration(summary.duration_seconds)}
      hint="Time of the last sample"
      tone="idle"
      icon={<IconClock size={ICON_SIZES.card} />}
    />
    <MetricCard
      label="Average FPS"
      value={formatDecimal(summary.average_fps)}
      hint="Frames actually processed"
      tone="idle"
      icon={<IconBolt size={ICON_SIZES.card} />}
    />
    <MetricCard
      label="Face"
      value={formatDecimal(summary.face_percent, '%')}
      hint="Seconds with a face"
      tone="idle"
      icon={<IconUser size={ICON_SIZES.card} />}
    />
    <MetricCard
      label="Good"
      value={formatDecimal(summary.good_percent, '%')}
      hint="Seconds with verdict Good"
      tone="idle"
      icon={<IconCircleCheck size={ICON_SIZES.card} />}
    />
  </SimpleGrid>
);

export default memo(SessionSummaryGrid);

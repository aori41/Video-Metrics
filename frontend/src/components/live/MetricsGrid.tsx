import { SimpleGrid } from '@mantine/core';
import { IconBolt, IconRun, IconSun, IconUser } from '@tabler/icons-react';
import React, { memo } from 'react';
import { ICON_SIZES } from '../../theme';
import type { Sample, Thresholds } from '../../types/metrics';
import { toneOf } from '../../utils/formatters';
import MetricCard from './MetricCard';

type Props = {
  latest: Sample | null;
  thresholds: Thresholds;
};

const EMPTY_VALUE = '–';

const MetricsGrid: React.FC<Props> = ({ latest, thresholds }) => {
  const isReady = latest !== null;
  const brightnessOk =
    isReady &&
    latest.brightness >= thresholds.brightnessMin &&
    latest.brightness <= thresholds.brightnessMax;

  return (
    <SimpleGrid cols={2} spacing="md">
      <MetricCard
        label="FPS"
        value={isReady ? latest.fps.toFixed(1) : EMPTY_VALUE}
        hint={`Minimum ${thresholds.fpsMin}`}
        tone={toneOf(isReady, isReady && latest.fps >= thresholds.fpsMin)}
        icon={<IconBolt size={ICON_SIZES.card} />}
      />
      <MetricCard
        label="Brightness"
        value={isReady ? latest.brightness.toFixed(1) : EMPTY_VALUE}
        hint={`Between ${thresholds.brightnessMin} and ${thresholds.brightnessMax}`}
        tone={toneOf(isReady, brightnessOk)}
        icon={<IconSun size={ICON_SIZES.card} />}
      />
      <MetricCard
        label="Motion"
        value={isReady ? latest.motion.toFixed(1) : EMPTY_VALUE}
        hint={`Maximum ${thresholds.motionMax}`}
        tone={toneOf(isReady, isReady && latest.motion <= thresholds.motionMax)}
        icon={<IconRun size={ICON_SIZES.card} />}
      />
      <MetricCard
        label="Face"
        value={isReady ? (latest.face ? 'Detected' : 'No face') : EMPTY_VALUE}
        hint="At least one face in the frame"
        tone={toneOf(isReady, isReady && latest.face)}
        icon={<IconUser size={ICON_SIZES.card} />}
      />
    </SimpleGrid>
  );
};

export default memo(MetricsGrid);

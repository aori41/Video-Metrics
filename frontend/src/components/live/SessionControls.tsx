import { Badge, Button, Group } from '@mantine/core';
import { IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import React, { memo } from 'react';
import { PHASE_LABELS, RECORDING_PHASES, STARTING_PHASES } from '../../domain/phaseLabels';
import { ICON_SIZES } from '../../theme';
import type { SessionPhase } from '../../types/session';

type Props = {
  phase: SessionPhase;
  onStart: () => void;
  onStop: () => void;
};

const SessionControls: React.FC<Props> = ({ phase, onStart, onStop }) => {
  const isRecording = RECORDING_PHASES.includes(phase);
  const isStopping = phase === 'stopping';

  return (
    <Group justify="space-between">
      {isRecording || isStopping ? (
        <Button
          color="red"
          leftSection={<IconPlayerStop size={ICON_SIZES.button} />}
          loading={isStopping}
          onClick={onStop}
        >
          Stop
        </Button>
      ) : (
        <Button
          leftSection={<IconPlayerPlay size={ICON_SIZES.button} />}
          loading={STARTING_PHASES.includes(phase)}
          onClick={onStart}
        >
          Start
        </Button>
      )}
      <Badge variant="light" size="lg" color={phase === 'running' ? 'red' : 'gray'}>
        {PHASE_LABELS[phase]}
      </Badge>
    </Group>
  );
};

export default memo(SessionControls);

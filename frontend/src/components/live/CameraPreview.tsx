import { AspectRatio, Center, Overlay, Paper, Stack, Text } from '@mantine/core';
import { IconCamera, IconPlayerPause } from '@tabler/icons-react';
import React, { memo, type Ref } from 'react';
import { RECORDING_PHASES } from '../../domain/phaseLabels';
import { ICON_SIZES } from '../../theme';
import type { SessionPhase } from '../../types/session';

type Props = {
  ref: Ref<HTMLVideoElement>;
  phase: SessionPhase;
};

const VIDEO_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  transform: 'scaleX(-1)',
  display: 'block',
};

const CameraPreview: React.FC<Props> = ({ ref, phase }) => {
  const isOff = !RECORDING_PHASES.includes(phase) && phase !== 'creating_session';

  return (
    <Paper withBorder radius="md" style={{ overflow: 'hidden', background: 'black' }}>
      <AspectRatio ratio={4 / 3} pos="relative">
        <video ref={ref} muted playsInline aria-label="Camera preview" style={VIDEO_STYLE} />
        {isOff && (
          <Center pos="absolute" inset={0}>
            <Stack align="center" gap={4}>
              <IconCamera size={ICON_SIZES.placeholder} color="gray" />
              <Text size="sm" c="gray.5">
                Camera is off
              </Text>
            </Stack>
          </Center>
        )}
        {phase === 'paused' && (
          <Overlay backgroundOpacity={0.6} center>
            <Stack align="center" gap={4}>
              <IconPlayerPause size={ICON_SIZES.placeholder} color="white" />
              <Text size="sm" c="white">
                Paused
              </Text>
            </Stack>
          </Overlay>
        )}
      </AspectRatio>
    </Paper>
  );
};

export default memo(CameraPreview);

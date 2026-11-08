import { Grid, Stack } from '@mantine/core';
import React, { useCallback, useRef } from 'react';
import { appConfig } from '../../config/env';
import { useSessionController } from '../../hooks/useSessionController';
import SessionChart from '../charts/SessionChart';
import CameraPreview from './CameraPreview';
import MetricsGrid from './MetricsGrid';
import SessionAlerts from './SessionAlerts';
import SessionControls from './SessionControls';
import VerdictBanner from './VerdictBanner';

const LiveScreen: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { snapshot, start, stop } = useSessionController();

  const handleStart = useCallback(() => {
    if (videoRef.current) start(videoRef.current);
  }, [start]);

  return (
    <Stack gap="md">
      <SessionAlerts snapshot={snapshot} />
      <Grid gap="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="sm">
            <CameraPreview ref={videoRef} phase={snapshot.phase} />
            <SessionControls phase={snapshot.phase} onStart={handleStart} onStop={stop} />
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="md">
            <VerdictBanner latest={snapshot.latest} phase={snapshot.phase} />
            <MetricsGrid latest={snapshot.latest} thresholds={appConfig.thresholds} />
          </Stack>
        </Grid.Col>
      </Grid>
      <SessionChart
        title={`Last ${appConfig.chartWindowSeconds} seconds`}
        samples={snapshot.history}
        windowSeconds={appConfig.chartWindowSeconds}
      />
    </Stack>
  );
};

export default LiveScreen;

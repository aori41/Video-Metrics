import { Button, Group, Stack, Text } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import React, { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import { sessionsController } from '../../controllers/sessions';
import { useApiResource } from '../../hooks/useApiResource';
import { ICON_SIZES } from '../../theme';
import { formatDateTime } from '../../utils/formatters';
import SessionChart from '../charts/SessionChart';
import ResourceFeedback from './ResourceFeedback';
import SessionSummaryGrid from './SessionSummaryGrid';

const MIN_CHART_SECONDS = 1;

const SessionDetailScreen: React.FC = () => {
  const { sessionId = '' } = useParams();
  const load = useCallback(() => sessionsController.getSession(sessionId), [sessionId]);
  const resource = useApiResource(load);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Button
          component={Link}
          to="/history"
          variant="subtle"
          leftSection={<IconArrowLeft size={ICON_SIZES.button} />}
        >
          Back
        </Button>
        {resource.status === 'ready' && (
          <Text size="sm" c="dimmed">
            {formatDateTime(resource.data.started_at)}
          </Text>
        )}
      </Group>
      {resource.status === 'ready' ? (
        <>
          <SessionSummaryGrid summary={resource.data.summary} />
          <SessionChart
            title="Full session"
            samples={resource.data.samples}
            windowSeconds={Math.max(resource.data.summary.duration_seconds, MIN_CHART_SECONDS)}
          />
        </>
      ) : (
        <ResourceFeedback resource={resource} />
      )}
    </Stack>
  );
};

export default SessionDetailScreen;

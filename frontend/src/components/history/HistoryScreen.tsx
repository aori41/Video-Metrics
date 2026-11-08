import { Center, Text } from '@mantine/core';
import React, { useCallback } from 'react';
import { sessionsController } from '../../controllers/sessions';
import { useApiResource } from '../../hooks/useApiResource';
import ResourceFeedback from './ResourceFeedback';
import SessionsTable from './SessionsTable';

const HistoryScreen: React.FC = () => {
  const load = useCallback(() => sessionsController.listSessions(), []);
  const resource = useApiResource(load);

  if (resource.status !== 'ready') return <ResourceFeedback resource={resource} />;
  if (resource.data.length === 0) {
    return (
      <Center py="xl">
        <Text c="dimmed">No sessions yet</Text>
      </Center>
    );
  }
  return <SessionsTable sessions={resource.data} />;
};

export default HistoryScreen;

import { Alert, Button, Container, Stack } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import React, { useCallback } from 'react';
import { ICON_SIZES } from '../../theme';

const AppErrorFallback: React.FC = () => {
  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <Container size="sm" py="xl">
      <Stack>
        <Alert color="red" icon={<IconAlertTriangle size={ICON_SIZES.card} />} title="Something went wrong">
          The page hit an unexpected error. Saved sessions are not affected.
        </Alert>
        <Button onClick={handleReload}>Reload the page</Button>
      </Stack>
    </Container>
  );
};

export default AppErrorFallback;

import { Alert, Stack } from '@mantine/core';
import { IconAlertTriangle, IconCircleCheck, IconWifiOff } from '@tabler/icons-react';
import type React from 'react';
import { ICON_SIZES } from '../../theme';
import type { SessionSnapshot } from '../../types/session';

type Props = {
  snapshot: SessionSnapshot;
};

const SessionAlerts: React.FC<Props> = ({ snapshot }) => {
  const { notice, connectionProblem, pending, permanentError, saveResult } = snapshot;
  const hasMissingSamples = saveResult !== null && saveResult.saved < saveResult.produced;

  return (
    <Stack gap="xs">
      {notice && (
        <Alert color="red" icon={<IconAlertTriangle size={ICON_SIZES.card} />}>
          {notice}
        </Alert>
      )}
      {permanentError && (
        <Alert color="red" icon={<IconAlertTriangle size={ICON_SIZES.card} />}>
          Samples could not be saved: {permanentError}
        </Alert>
      )}
      {connectionProblem && (
        <Alert color="yellow" icon={<IconWifiOff size={ICON_SIZES.card} />}>
          Connection problem, retrying ({pending} samples waiting)
        </Alert>
      )}
      {saveResult && (
        <Alert
          color={hasMissingSamples ? 'yellow' : 'teal'}
          icon={<IconCircleCheck size={ICON_SIZES.card} />}
        >
          Saved {saveResult.saved} of {saveResult.produced} samples
        </Alert>
      )}
    </Stack>
  );
};

export default SessionAlerts;

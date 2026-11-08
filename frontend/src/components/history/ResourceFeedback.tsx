import { Alert, Center, Loader } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type React from 'react';
import { ICON_SIZES } from '../../theme';
import type { ApiResource } from '../../types/session';

type Props = {
  resource: Exclude<ApiResource<unknown>, { status: 'ready' }>;
};

const ResourceFeedback: React.FC<Props> = ({ resource }) =>
  resource.status === 'loading' ? (
    <Center py="xl">
      <Loader aria-label="Loading" />
    </Center>
  ) : (
    <Alert color="red" icon={<IconAlertTriangle size={ICON_SIZES.card} />}>
      {resource.message}
    </Alert>
  );

export default ResourceFeedback;

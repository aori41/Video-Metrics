import { Box, Text } from '@mantine/core';
import React, { memo, useMemo } from 'react';
import { CHART_PLOT_LEFT_INSET, CHART_PLOT_RIGHT_INSET } from '../../config/chart';
import { buildGradient, describeValues } from '../../utils/chart';

type Props = {
  label: string;
  values: (boolean | null)[];
};

const StatusStrip: React.FC<Props> = ({ label, values }) => {
  const background = useMemo(() => buildGradient(values), [values]);
  const description = useMemo(() => describeValues(label, values), [label, values]);

  return (
    <Box pl={CHART_PLOT_LEFT_INSET} pr={CHART_PLOT_RIGHT_INSET}>
      <Text size="xs" c="dimmed" mb={2}>
        {label}
      </Text>
      <Box h={10} style={{ background }} role="img" aria-label={description} />
    </Box>
  );
};

export default memo(StatusStrip);

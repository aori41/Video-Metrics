import { Group, Text, ThemeIcon, Title } from '@mantine/core';
import { IconVideo } from '@tabler/icons-react';
import type React from 'react';
import { ICON_SIZES } from '../../theme';
import AppNav from './AppNav';

const AppHeader: React.FC = () => (
  <Group justify="space-between" mb="lg">
    <Group gap="sm">
      <ThemeIcon size="lg" variant="light">
        <IconVideo size={ICON_SIZES.header} />
      </ThemeIcon>
      <div>
        <Title order={3}>Camera Metrics</Title>
        <Text size="sm" c="dimmed">
          Live video quality, analyzed in your browser. Video never leaves this device.
        </Text>
      </div>
    </Group>
    <AppNav />
  </Group>
);

export default AppHeader;

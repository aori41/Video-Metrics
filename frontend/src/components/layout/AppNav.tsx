import { Button, Group } from '@mantine/core';
import type React from 'react';
import { Link, useLocation } from 'react-router';

const AppNav: React.FC = () => {
  const { pathname } = useLocation();
  const isHistory = pathname.startsWith('/history');

  return (
    <Group gap="xs" component="nav" aria-label="Main">
      <Button component={Link} to="/" variant={isHistory ? 'subtle' : 'light'}>
        Live
      </Button>
      <Button component={Link} to="/history" variant={isHistory ? 'light' : 'subtle'}>
        History
      </Button>
    </Group>
  );
};

export default AppNav;

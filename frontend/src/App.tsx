import { Box, Container } from '@mantine/core';
import { Outlet, useMatch } from 'react-router';
import AppHeader from './components/layout/AppHeader';
import LiveScreen from './components/live/LiveScreen';

function App() {
  const isLive = useMatch('/') !== null;

  return (
    <Container size="lg" py="lg">
      <AppHeader />
      {/* Stays mounted, so a recording keeps running while History is open. */}
      <Box display={isLive ? 'block' : 'none'}>
        <LiveScreen />
      </Box>
      <Outlet />
    </Container>
  );
}

export default App;

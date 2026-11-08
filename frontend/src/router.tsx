import { createBrowserRouter } from 'react-router';
import App from './App';
import HistoryScreen from './components/history/HistoryScreen';
import SessionDetailScreen from './components/history/SessionDetailScreen';
import AppErrorFallback from './components/layout/AppErrorFallback';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: App,
    ErrorBoundary: AppErrorFallback,
    children: [
      { index: true, element: null },
      { path: 'history', Component: HistoryScreen },
      { path: 'history/:sessionId', Component: SessionDetailScreen },
      { path: '*', element: null },
    ],
  },
]);

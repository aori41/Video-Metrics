import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { healthController } from '../controllers/health';
import { sessionsController } from '../controllers/sessions';
import { appConfig } from '../config/env';
import { createSessionController } from '../session/createSessionController';
import type { ISessionController } from '../types/contracts';
import type { UseSessionControllerResult } from '../types/session';

export function useSessionController(): UseSessionControllerResult {
  const [controller] = useState<ISessionController>(() =>
    createSessionController(appConfig, sessionsController),
  );
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

  // Wakes the sleeping backend and loads the model, so Start responds quickly.
  useEffect(() => {
    healthController.check().catch(() => undefined);
    controller.preload();
    return controller.dispose;
  }, [controller]);

  const start = useCallback(
    (video: HTMLVideoElement) => {
      void controller.start(video);
    },
    [controller],
  );

  const stop = useCallback(() => {
    void controller.stop();
  }, [controller]);

  return { snapshot, start, stop };
}

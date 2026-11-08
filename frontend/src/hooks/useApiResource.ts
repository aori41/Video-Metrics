import { useEffect, useState } from 'react';
import type { ApiResource, SettledResource } from '../types/session';

const FALLBACK_ERROR = 'The data could not be loaded.';
const LOADING = { status: 'loading' } as const;

// `load` must be memoized, because a new function starts a new request.
export function useApiResource<T>(load: () => Promise<T>): ApiResource<T> {
  const [settled, setSettled] = useState<SettledResource<T> | null>(null);

  useEffect(() => {
    let isCurrent = true;

    load().then(
      (data) => {
        if (isCurrent) setSettled({ load, resource: { status: 'ready', data } });
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : FALLBACK_ERROR;
        if (isCurrent) setSettled({ load, resource: { status: 'error', message } });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [load]);

  return settled?.load === load ? settled.resource : LOADING;
}

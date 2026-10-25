import { useRef, useCallback } from 'react';

interface PendingRequest {
  controller: AbortController;
  timestamp: number;
}

export function useRequestQueue() {
  const pendingRequests = useRef<Map<string, PendingRequest>>(new Map());
  const requestTimeout = useRef<NodeJS.Timeout | null>(null);

  const isPending = useCallback((key: string) => {
    return pendingRequests.current.has(key);
  }, []);

  const addRequest = useCallback((key: string) => {
    const controller = new AbortController();
    pendingRequests.current.set(key, {
      controller,
      timestamp: Date.now(),
    });
    return controller;
  }, []);

  const removeRequest = useCallback((key: string) => {
    pendingRequests.current.delete(key);
  }, []);

  const cancelRequest = useCallback((key: string) => {
    const request = pendingRequests.current.get(key);
    if (request) {
      request.controller.abort();
      pendingRequests.current.delete(key);
    }
  }, []);

  const executeRequest = useCallback(
    async <T,>(
      key: string,
      fn: (signal: AbortSignal) => Promise<T>,
      options?: { timeout?: number; onDuplicate?: () => void }
    ): Promise<T> => {
      if (isPending(key)) {
        options?.onDuplicate?.();
        throw new Error('Request already in progress');
      }

      const controller = addRequest(key);
      const timeout = options?.timeout || 30000;

      try {
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        const result = await fn(controller.signal);
        clearTimeout(timeoutId);
        return result;
      } finally {
        removeRequest(key);
      }
    },
    [isPending, addRequest, removeRequest]
  );

  const cleanup = useCallback(() => {
    pendingRequests.current.forEach((request) => {
      request.controller.abort();
    });
    pendingRequests.current.clear();
    if (requestTimeout.current) {
      clearTimeout(requestTimeout.current);
    }
  }, []);

  return {
    isPending,
    executeRequest,
    cancelRequest,
    cleanup,
    pendingCount: pendingRequests.current.size,
  };
}

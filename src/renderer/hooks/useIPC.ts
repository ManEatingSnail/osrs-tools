import { useCallback, useEffect, useRef } from 'react'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { PlayerUpdateDiff, ConnectionStatusUpdate } from '@shared/types'

/**
 * Typed invoke wrapper. Returns a function that calls
 * window.electronAPI.invoke with the correct channel.
 */
export function useInvoke<TReq, TRes>(channel: string) {
  return useCallback(
    async (data?: TReq): Promise<TRes> => {
      return window.electronAPI.invoke(channel, data) as Promise<TRes>
    },
    [channel]
  )
}

/**
 * Subscribe to real-time player updates from main process.
 * Automatically cleans up on unmount.
 */
export function usePlayerUpdateListener(
  callback: (diff: PlayerUpdateDiff) => void
): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const unsub = window.electronAPI.onPlayerUpdate((data) => {
      callbackRef.current(data as PlayerUpdateDiff)
    })
    return unsub
  }, [])
}

/**
 * Subscribe to connection status updates from main process.
 */
export function useConnectionStatusListener(
  callback: (update: ConnectionStatusUpdate) => void
): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const unsub = window.electronAPI.onConnectionStatus((data) => {
      callbackRef.current(data as ConnectionStatusUpdate)
    })
    return unsub
  }, [])
}

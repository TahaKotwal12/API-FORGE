declare module 'y-websocket/bin/utils' {
  import type { WebSocket } from 'ws';
  import type { IncomingMessage } from 'http';

  export function setupWSConnection(
    ws: WebSocket,
    req: IncomingMessage,
    options?: { gc?: boolean; docName?: string },
  ): void;
}

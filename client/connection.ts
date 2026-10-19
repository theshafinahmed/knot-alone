// The live phone line 📞 between this game page and the boss server.

import { SOCKET_PATH } from '../shared/config';
import type { ServerMessage } from '../shared/messages';

export function connect(onMessage: (message: ServerMessage) => void, onStatus: (online: boolean) => void) {
  // Works on localhost (ws://) and through the tunnel later (wss://).
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${location.host}${SOCKET_PATH}`;

  const open = () => {
    const socket = new WebSocket(url);
    socket.onopen = () => onStatus(true);
    socket.onmessage = (event) => onMessage(JSON.parse(event.data) as ServerMessage);
    socket.onclose = () => {
      onStatus(false);
      setTimeout(open, 2000); // Try again if the line drops.
    };
  };
  open();
}

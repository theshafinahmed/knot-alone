// The live phone line 📞 between this game page and the boss server.

import { SOCKET_PATH } from '../shared/config';
import type { ClientMessage, ServerMessage } from '../shared/messages';

export class Connection {
  private socket: WebSocket | null = null;
  online = false;

  constructor(
    private onMessage: (message: ServerMessage) => void,
    private onStatus: (online: boolean) => void,
  ) {
    this.open();
  }

  send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private open() {
    // Works on localhost (ws://) and through the tunnel later (wss://).
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}${SOCKET_PATH}`);
    this.socket = socket;
    socket.onopen = () => {
      this.online = true;
      this.onStatus(true);
    };
    socket.onmessage = (event) => this.onMessage(JSON.parse(event.data) as ServerMessage);
    socket.onclose = () => {
      this.online = false;
      this.onStatus(false);
      setTimeout(() => this.open(), 1500); // try again if the line drops
    };
  }
}

/** A secret random id saved on this phone, so the server knows it's still you after a reconnect. */
export function playerToken() {
  const KEY = 'knot.token';
  try {
    let token = localStorage.getItem(KEY);
    if (!token) {
      token = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(KEY, token);
    }
    return token;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

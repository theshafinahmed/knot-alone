// The shapes of messages sent between the server and the game page.

/** Server → game page */
export type ServerMessage =
  | { type: 'welcome'; playerId: string; playersOnline: number }
  | { type: 'players'; playersOnline: number };

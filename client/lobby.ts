// The join screen and the lobby 🏠 (plain web page parts on top of the 3D world).

import { HAT_LABEL, HATS, NAME_MAX, SHIRT_COLORS, cleanName, type Hat } from '../shared/looks';
import type { LobbyPlayer } from '../shared/messages';
import { MAX_PLAYERS, ROPE_MODES, modeFits, type RopeMode } from '../shared/teams';

export interface Look {
  name: string;
  color: number;
  hat: Hat;
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** Short names for the three rope modes (the buttons are narrow on phones). */
const MODE_NAME: Record<RopeMode, string> = {
  chain: 'One chain',
  teams3: 'Teams of 3',
  teams2: 'Teams of 2',
};

const ICON_CROWN =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 18l-1-10 5 4 4-7 4 7 5-4-1 10z"/></svg>';
const ICON_ROBOT =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="8" width="14" height="10" rx="3"/><path d="M12 8V5"/></svg>';

// ---------- Remember my look on this phone ----------

const LOOK_KEY = 'knot.look';

export function loadLook(): Look | null {
  try {
    const saved = JSON.parse(localStorage.getItem(LOOK_KEY) ?? 'null');
    if (saved && typeof saved.name === 'string') {
      return {
        name: cleanName(saved.name),
        color: (SHIRT_COLORS as readonly number[]).includes(saved.color) ? saved.color : SHIRT_COLORS[0],
        hat: (HATS as readonly string[]).includes(saved.hat) ? saved.hat : 'none',
      };
    }
  } catch {
    // no saved look (or storage is blocked) — that's fine
  }
  return null;
}

function saveLook(look: Look) {
  try {
    localStorage.setItem(LOOK_KEY, JSON.stringify(look));
  } catch {
    // storage blocked — the look just won't be remembered
  }
}

// ---------- Join screen ----------

export class JoinScreen {
  private look: Look;
  private readonly root = $('#join');
  private readonly nameInput = $<HTMLInputElement>('#name');
  private readonly message = $('#join-message');

  constructor(onJoin: (look: Look) => void) {
    this.look = loadLook() ?? {
      name: '',
      color: SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)],
      hat: 'none',
    };
    this.nameInput.maxLength = NAME_MAX;
    this.nameInput.value = this.look.name;
    this.nameInput.addEventListener('input', () => this.refresh());

    const colors = $('#colors');
    for (const color of SHIRT_COLORS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sw';
      button.style.setProperty('--c', hex(color));
      button.setAttribute('aria-label', `Shirt color ${hex(color)}`);
      button.addEventListener('click', () => {
        this.look.color = color;
        this.refresh();
      });
      button.dataset.color = String(color);
      colors.append(button);
    }

    const hats = $('#hats');
    for (const hat of HATS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip';
      button.textContent = HAT_LABEL[hat];
      button.dataset.hat = hat;
      button.addEventListener('click', () => {
        this.look.hat = hat;
        this.refresh();
      });
      hats.append(button);
    }

    $<HTMLFormElement>('#join-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const name = this.nameInput.value.trim();
      if (!name) {
        this.showMessage('Type your name first');
        this.nameInput.focus();
        return;
      }
      this.look.name = cleanName(name);
      saveLook(this.look);
      this.nameInput.blur();
      onJoin({ ...this.look });
    });

    this.refresh();
  }

  show(buttonText = 'Join game') {
    $('#join-button-text').textContent = buttonText;
    this.showMessage('');
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
  }

  get isOpen() {
    return !this.root.classList.contains('hidden');
  }

  showMessage(text: string) {
    this.message.textContent = text;
  }

  /** "2 friends are waiting in the lobby" under the Join button. */
  setOnline(count: number) {
    const line = $('#join-waiting');
    line.classList.toggle('hidden', count <= 0);
    $('#join-waiting-text').textContent = `${count} ${count === 1 ? 'friend is' : 'friends are'} waiting in the lobby`;
  }

  private refresh() {
    for (const button of document.querySelectorAll<HTMLButtonElement>('#colors button')) {
      const picked = Number(button.dataset.color) === this.look.color;
      button.classList.toggle('picked', picked);
      button.setAttribute('aria-pressed', String(picked));
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>('#hats button')) {
      const picked = button.dataset.hat === this.look.hat;
      button.classList.toggle('picked', picked);
      button.setAttribute('aria-pressed', String(picked));
    }
    // The flat picture of my character in the card.
    const color = hex(this.look.color);
    $('#join-preview').style.setProperty('--c', color);
    $('#fc-hat').className = `fc-hat hat-${this.look.hat}`;
    $('#ptag-dot').style.background = color;
    $('#ptag-name').textContent = this.nameInput.value.trim() || 'Your name';
  }
}

// ---------- Lobby panel ----------

export interface LobbyActions {
  setMode: (mode: RopeMode) => void;
  setBots: (bots: number) => void;
  start: () => void;
  editLook: () => void;
}

export class LobbyPanel {
  private readonly root = $('#lobby');
  private mode: RopeMode = 'chain';
  private bots = 0;
  private people = 0;

  constructor(private actions: LobbyActions) {
    const modes = $('#modes');
    for (const mode of ROPE_MODES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = MODE_NAME[mode];
      button.dataset.mode = mode;
      button.addEventListener('click', () => actions.setMode(mode));
      modes.append(button);
    }
    $('#bots-minus').addEventListener('click', () => actions.setBots(this.bots - 1));
    $('#bots-plus').addEventListener('click', () => actions.setBots(this.bots + 1));
    $('#start-button').addEventListener('click', () => actions.start());
    $('#edit-look').addEventListener('click', () => actions.editLook());
  }

  show() {
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
  }

  update(players: LobbyPlayer[], myId: string | null, mode: RopeMode, bots: number) {
    this.mode = mode;
    this.bots = bots;
    this.people = players.length;
    const total = this.people + bots;

    $('#lobby-count').textContent = `${total} of ${MAX_PLAYERS} players`;

    const badge = (text: string, kind: string, icon = '') => {
      const el = document.createElement('span');
      el.className = `badge ${kind}`;
      el.innerHTML = icon;
      el.append(text);
      return el;
    };

    const list = $('#lobby-list');
    const rows = players.map((player) => {
      const item = document.createElement('li');
      if (!player.online) item.classList.add('away');
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.setProperty('--c', hex(player.color));
      const name = document.createElement('span');
      name.className = 'rname';
      name.textContent = player.name;
      item.append(dot, name);
      if (player.host) item.append(badge('Host', 'gold', ICON_CROWN));
      if (player.id === myId) item.append(badge('You', 'soft'));
      if (!player.online) item.append(badge('Away', 'soft'));
      return item;
    });
    if (bots > 0) {
      const item = document.createElement('li');
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.setProperty('--c', '#3b4a63');
      const name = document.createElement('span');
      name.className = 'rname';
      name.textContent = bots === 1 ? '1 robot buddy' : `${bots} robot buddies`;
      item.append(dot, name, badge('Robot', 'soft', ICON_ROBOT));
      rows.push(item);
    }
    list.replaceChildren(...rows);

    const amHost = players.some((p) => p.host && p.id === myId);
    $('#host-controls').classList.toggle('hidden', !amHost);
    $('#waiting').classList.toggle('hidden', amHost);

    for (const button of document.querySelectorAll<HTMLButtonElement>('#modes button')) {
      const buttonMode = button.dataset.mode as RopeMode;
      button.classList.toggle('picked', buttonMode === mode);
      button.disabled = !modeFits(buttonMode, total);
    }
    $('#bots-count').textContent = String(bots);
    $<HTMLButtonElement>('#bots-minus').disabled = bots <= 0;
    $<HTMLButtonElement>('#bots-plus').disabled = total >= MAX_PLAYERS;
  }

  /** The rope mode that's picked right now (for showing hints). */
  get currentMode() {
    return this.mode;
  }
}

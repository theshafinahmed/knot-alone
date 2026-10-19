// The join screen and the lobby 🏠 (plain web page parts on top of the 3D world).

import { HAT_EMOJI, HATS, NAME_MAX, SHIRT_COLORS, cleanName, type Hat } from '../shared/looks';
import type { LobbyPlayer } from '../shared/messages';
import { MAX_PLAYERS, MODE_LABEL, ROPE_MODES, modeFits, type RopeMode } from '../shared/teams';

export interface Look {
  name: string;
  color: number;
  hat: Hat;
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

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

    const colors = $('#colors');
    for (const color of SHIRT_COLORS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.style.background = hex(color);
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
      button.textContent = HAT_EMOJI[hat];
      button.title = hat;
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
        this.showMessage('Type your name first 🙂');
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
    $('#join-button').textContent = buttonText;
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

  private refresh() {
    for (const button of document.querySelectorAll<HTMLButtonElement>('#colors button')) {
      button.classList.toggle('picked', Number(button.dataset.color) === this.look.color);
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>('#hats button')) {
      button.classList.toggle('picked', button.dataset.hat === this.look.hat);
    }
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
      button.textContent = MODE_LABEL[mode];
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

    $('#lobby-count').textContent = `${this.people} ${this.people === 1 ? 'person' : 'people'}${bots ? ` + ${bots} 🤖` : ''}`;

    const list = $('#lobby-list');
    list.replaceChildren(
      ...players.map((player) => {
        const item = document.createElement('li');
        if (!player.online) item.classList.add('away');
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = hex(player.color);
        const name = document.createElement('span');
        name.textContent = `${player.name} ${player.hat === 'none' ? '' : HAT_EMOJI[player.hat]}`;
        item.append(dot, name);
        const tags = [player.host ? '👑 host' : '', player.id === myId ? 'you' : '', player.online ? '' : 'away']
          .filter(Boolean)
          .join(' · ');
        if (tags) {
          const tag = document.createElement('span');
          tag.className = 'tag';
          tag.textContent = tags;
          item.append(tag);
        }
        return item;
      }),
    );

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

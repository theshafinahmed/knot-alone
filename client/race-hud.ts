// The race on screen ⏱️: big "3, 2, 1, GO!", the timer, checkpoint pop-ups and the results card.

import type { LobbyPlayer } from '../shared/messages';
import { sounds } from './sounds';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

/** 75.3 seconds → "1:15.3" */
export function formatTime(seconds: number) {
  const s = Math.max(0, seconds);
  const minutes = Math.floor(s / 60);
  const rest = s - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
}

export interface RaceInfo {
  raceTime: number;
  /** Index of my team, or −1 if I'm only watching. */
  myTeam: number;
  /** [last checkpoint, finish time or −1] per team. */
  progress: [number, number][];
  bestTime: number;
  checkpointCount: number;
  amHost: boolean;
}

export class RaceHud {
  private shownCountdown = '';
  private lastCheckpoint = -1;
  private resultsKey = '';
  private resultsClosed = false;
  private toastTimer: number | undefined;

  constructor(
    private teams: string[][],
    private players: Map<string, LobbyPlayer>,
    actions: { playAgain: () => void; lobby: () => void },
  ) {
    $('#results-again').onclick = () => actions.playAgain();
    $('#results-lobby').onclick = () => actions.lobby();
    $('#results-close').onclick = () => {
      this.resultsClosed = true;
      $('#results').classList.add('hidden');
    };
    $('#timer').classList.remove('hidden');
  }

  dispose() {
    for (const id of ['#timer', '#countdown', '#toast', '#results']) $(id).classList.add('hidden');
    clearTimeout(this.toastTimer);
  }

  update(info: RaceInfo) {
    const { raceTime, myTeam, progress } = info;
    const mine = progress[myTeam];

    // ⏱️ Timer: counts up from GO. Freezes at your finish time.
    const myFinish = mine && mine[1] >= 0 ? mine[1] : null;
    $('#timer').textContent = myFinish !== null ? `🏁 ${formatTime(myFinish)}` : `⏱️ ${formatTime(raceTime)}`;

    // 3, 2, 1, GO!
    let countdown = '';
    if (raceTime < 0) countdown = String(Math.ceil(-raceTime));
    else if (raceTime < 0.9) countdown = 'GO!';
    if (countdown !== this.shownCountdown) {
      this.shownCountdown = countdown;
      const el = $('#countdown');
      el.textContent = countdown;
      el.classList.toggle('hidden', !countdown);
      el.classList.remove('pop');
      void el.offsetWidth; // restart the pop animation
      el.classList.add('pop');
      if (countdown === 'GO!') sounds.go();
      else if (countdown) sounds.countdownBeep();
    }

    // ✅ Checkpoint pop-up when my team reaches a new one.
    if (mine) {
      if (this.lastCheckpoint >= 0 && mine[0] > this.lastCheckpoint) {
        this.toast(`✅ Checkpoint ${mine[0]} of ${info.checkpointCount - 1}!`);
      }
      this.lastCheckpoint = mine[0];
    }

    // 🏆 Results: show when my team finished (or, if I'm watching, when anyone finished).
    const anyFinished = progress.some((p) => p[1] >= 0);
    const show = myFinish !== null || (myTeam < 0 && anyFinished);
    const key = JSON.stringify([progress.map((p) => p[1]), info.amHost, info.bestTime]);
    if (show && !this.resultsClosed) {
      if (key !== this.resultsKey) this.renderResults(info);
      $('#results').classList.remove('hidden');
    }
    this.resultsKey = key;
  }

  private renderResults(info: RaceInfo) {
    const allDone = info.progress.every((p) => p[1] >= 0);
    const order = info.progress
      .map((p, team) => ({ team, time: p[1] }))
      .sort((a, b) => (a.time < 0 ? Infinity : a.time) - (b.time < 0 ? Infinity : b.time));
    const medals = ['🥇', '🥈', '🥉'];

    $('#results-title').textContent =
      info.progress.length === 1 ? '🏆 You made it!' : order[0].team === info.myTeam ? '🏆 Your team won!' : '🏁 Finished!';

    const list = $('#results-list');
    list.replaceChildren(
      ...order.map(({ team, time }, place) => {
        const item = document.createElement('li');
        if (team === info.myTeam) item.classList.add('mine');
        const members = this.teams[team].map((id) => this.players.get(id)).filter((p) => !!p);
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = hex(members[0]?.color ?? 0xffffff);
        const names = document.createElement('span');
        names.className = 'names';
        names.textContent = `${time >= 0 ? (medals[place] ?? '🏁') : '🧗'} ${members.map((m) => m.name).join(', ')}`;
        const result = document.createElement('span');
        result.className = 'time';
        result.textContent = time >= 0 ? formatTime(time) : 'still going…';
        item.append(dot, names, result);
        return item;
      }),
    );

    $('#results-best').textContent = info.bestTime >= 0 ? `⭐ Best time tonight: ${formatTime(info.bestTime)}` : '';
    $('#results-host').classList.toggle('hidden', !info.amHost);
    $('#results-wait').classList.toggle('hidden', info.amHost);
    $('#results-wait').textContent = allDone ? 'Waiting for the host…' : 'Cheer on the others! 🎉';
  }

  private toast(text: string) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.remove('hidden', 'pop');
    void el.offsetWidth;
    el.classList.add('pop');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.add('hidden'), 2200);
  }
}

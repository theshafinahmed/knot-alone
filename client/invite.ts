// The invite card 📨 — a QR code and the link, so friends can join with one tap or one scan.

import QRCode from 'qrcode';
import type { Invite } from '../shared/messages';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

export class InviteCard {
  private readonly root = $('#invite');
  private invite: Invite | null = null;
  private drawnUrl: string | null = null;

  constructor() {
    $('#invite-close').addEventListener('click', () => this.hide());
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) this.hide(); // tap outside the card to close
    });

    $('#invite-share').addEventListener('click', async () => {
      if (!this.invite) return;
      try {
        await navigator.share({
          title: 'Knot Alone',
          text: "Come play Knot Alone with me! We're tied together 🪢",
          url: this.invite.url,
        });
      } catch {
        // closed the share sheet — nothing to do
      }
    });

    $('#invite-copy').addEventListener('click', async () => {
      if (!this.invite) return;
      const button = $('#invite-copy');
      try {
        await navigator.clipboard.writeText(this.invite.url);
        button.textContent = '✅ Copied';
      } catch {
        button.textContent = '👆 Select the link';
      }
      setTimeout(() => (button.textContent = '📋 Copy'), 1500);
    });
  }

  /** Called whenever the lobby tells us the invite link. */
  set(invite: Invite | null) {
    this.invite = invite;
    $('#open-invite').classList.toggle('hidden', !invite);
    if (!this.root.classList.contains('hidden')) this.render();
  }

  show() {
    if (!this.invite) return;
    this.render();
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
  }

  private render() {
    const invite = this.invite;
    if (!invite) return;
    $('#invite-where').textContent = invite.anywhere
      ? '🌍 Works for friends anywhere in the world'
      : '📶 Only works for friends on the same Wi-Fi';
    $('#invite-link').textContent = invite.url;
    // Share button only on phones/browsers that can share.
    $('#invite-share').classList.toggle('hidden', typeof navigator.share !== 'function');
    if (this.drawnUrl !== invite.url) {
      this.drawnUrl = invite.url;
      QRCode.toCanvas($<HTMLCanvasElement>('#invite-qr'), invite.url, { width: 220, margin: 1 }).catch(() => {});
    }
  }
}

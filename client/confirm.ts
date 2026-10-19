// "Are you sure?" box ❓ for the host's Restart and Lobby buttons (and their keyboard shortcuts).
// Esc or Cancel = no. Enter or the big button = yes.

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

let answer: ((yes: boolean) => void) | null = null;

export const isConfirmOpen = () => answer !== null;

export interface ConfirmOptions {
  title: string;
  text: string;
  /** Label of the "yes" button, like "Restart". */
  yes: string;
}

/** Shows the box. Resolves true if the host says yes, false for anything else. */
export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  closeConfirm();
  $('#confirm-title').textContent = options.title;
  $('#confirm-text').textContent = options.text;
  $('#confirm-yes-label').textContent = options.yes;
  $('#confirm').classList.remove('hidden');
  // The mouse has to be free to click the buttons.
  if (document.pointerLockElement) document.exitPointerLock();
  $('#confirm-yes').focus();
  return new Promise((resolve) => {
    answer = resolve;
  });
}

/** Closes the box without doing anything (also used when the game ends while it's open). */
export function closeConfirm() {
  finish(false);
}

function finish(yes: boolean) {
  const resolve = answer;
  answer = null;
  $('#confirm').classList.add('hidden');
  resolve?.(yes);
}

$('#confirm-yes').addEventListener('click', () => finish(true));
$('#confirm-no').addEventListener('click', () => finish(false));
window.addEventListener('keydown', (e) => {
  if (answer && e.code === 'Escape') {
    e.preventDefault();
    finish(false);
  }
});

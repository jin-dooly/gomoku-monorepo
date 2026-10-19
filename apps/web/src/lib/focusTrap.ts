import type { KeyboardEvent } from 'react';

/** 대화상자 안에서만 Tab이 돌게 해요. 대화상자 바깥 요소의 onKeyDown에서 불러요. */
export const trapTab = (e: KeyboardEvent<HTMLElement>): void => {
  if (e.key !== 'Tab') return;
  const buttons = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled)')];
  const first = buttons[0];
  const last = buttons[buttons.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last?.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first?.focus();
  }
};

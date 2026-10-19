import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import './ConfirmDialog.css';

type Props = {
  title: string;
  description: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * 되돌릴 수 없는 동작(기권, 나가기)의 확인창 (ux-spec 09).
 * 취소 쪽 버튼이 왼쪽, 되돌릴 수 없는 버튼만 빨강이에요. 실수로 누르지 않게 처음 포커스는 취소에 둬요.
 */
export const ConfirmDialog = ({ title, description, cancelLabel, confirmLabel, busy, error, onCancel, onConfirm }: Props) => {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    cancelRef.current?.focus();
    return () => (opener.current as HTMLElement | null)?.focus?.();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !busy) {
      e.preventDefault();
      onCancel();
    }
    // 확인창 안에서만 Tab이 돌게 해요.
    if (e.key === 'Tab') {
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
    }
  };

  return (
    <div className="confirm__scrim" onKeyDown={handleKeyDown}>
      <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}>
        <h2 id={titleId} className="t-title">
          {title}
        </h2>
        <p id={descId} className="t-body">
          {description}
        </p>
        {error && (
          <p className="t-body field__error" role="alert">
            {error}
          </p>
        )}
        <div className="confirm__actions">
          <button ref={cancelRef} className="btn btn--ghost" type="button" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button className="btn btn--danger confirm__go" type="button" onClick={onConfirm} disabled={busy} aria-busy={busy}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { PixelIcon } from './Pixel';
import './GameMenu.css';

type Props = {
  onResign: () => void;
  onLeave: () => void;
};

/**
 * 대국 중 ⋮ 메뉴 (ux-spec 08 모바일 시트 · 10 PC 드롭다운).
 * 같은 마크업을 화면 너비에 따라 아래에서 올라오는 시트 또는 버튼 아래 드롭다운으로 보여줘요.
 * 기권과 나가기는 되돌릴 수 없어서 바로 실행하지 않고 확인창으로 넘겨요.
 */
export const GameMenu = ({ onResign, onLeave }: Props) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  };

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
  }, [open]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex = (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const choose = (action: () => void) => {
    close(false);
    action();
  };

  return (
    <>
      <button
        ref={toggleRef}
        className="iconbtn"
        type="button"
        aria-label={open ? '대국 메뉴 닫기' : '대국 메뉴'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <PixelIcon name="menu" />
      </button>

      {open && (
        <>
          <div className="gmenu__scrim" onClick={() => close()} aria-hidden="true" />
          <div id={menuId} ref={menuRef} className="gmenu" role="menu" aria-label="대국 메뉴" onKeyDown={handleKeyDown}>
            <div className="gmenu__grip" aria-hidden="true" />
            <button className="gmenu__item" type="button" role="menuitem" onClick={() => choose(onResign)}>
              <PixelIcon name="flag" size={28} />
              <span className="gmenu__text">
                <span className="t-title">기권하기</span>
                <span className="t-body muted">이번 판만 패배로 끝내요 · 재대결할 수 있어요</span>
              </span>
            </button>
            <button className="gmenu__item" type="button" role="menuitem" onClick={() => choose(onLeave)}>
              <PixelIcon name="door" size={28} />
              <span className="gmenu__text">
                <span className="t-title">방 나가기</span>
                <span className="t-body muted">기권으로 처리되고 방 목록으로 돌아가요</span>
              </span>
            </button>
            <div className="gmenu__divider" role="separator" />
            {/* 규칙 보기 화면은 아직 기획되지 않았어요 (ux-spec 8장) */}
            <button className="gmenu__item gmenu__item--short" type="button" role="menuitem" disabled>
              <PixelIcon name="book" size={28} />
              <span className="gmenu__text">
                <span className="t-title">규칙 보기</span>
                <span className="t-body muted">준비 중이에요</span>
              </span>
            </button>
            <button className="btn btn--ghost btn--wide gmenu__close" type="button" onClick={() => close()}>
              닫기
            </button>
          </div>
        </>
      )}
    </>
  );
};

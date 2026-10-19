import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RulesDialog } from './RulesDialog';

describe('RulesDialog', () => {
  it('규칙 여섯 가지와 도트 예시판 두 개를 보여줘요', () => {
    render(<RulesDialog onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: '규칙' });
    const headings = within(dialog)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual(['이기는 법', '순서', '두는 법', '무승부', '기권과 나가기', '연결이 끊기면']);
    expect(within(dialog).getByRole('img', { name: '가로 5목 예시' })).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: '대각선 6목 예시' })).toBeInTheDocument();
  });

  it('처음 포커스는 닫기에 있고, 닫기·Esc·바깥을 누르면 닫혀요', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<RulesDialog onClose={onClose} />);

    expect(screen.getByRole('button', { name: '닫기' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: '닫기' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('dialog').parentElement!);

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('대화상자 안을 눌러도 닫히지 않아요', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<RulesDialog onClose={onClose} />);

    await user.click(screen.getByRole('heading', { name: '이기는 법' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('Tab은 스크롤되는 본문과 닫기 사이에서만 돌아요', async () => {
    const user = userEvent.setup();
    render(<RulesDialog onClose={vi.fn()} />);

    await user.tab();
    expect(screen.getByLabelText('규칙 내용')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: '닫기' })).toHaveFocus();
  });

  it('대국 중에 열면 실시간 상태를 위에 보여줘요', () => {
    render(<RulesDialog onClose={vi.fn()} liveStatus="내 차례예요" />);
    expect(screen.getByRole('status')).toHaveTextContent('내 차례예요');
  });
});

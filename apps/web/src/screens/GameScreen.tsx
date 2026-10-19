import { useEffect, useState } from 'react';
import {
  oppositeStone,
  toCoordinateLabel,
  type GameOverPayload,
  type GameStatePayload,
  type LineDirection,
  type Position,
  type Stone,
} from '@gomoku/shared';
import type { ConnectionStatus } from '../hooks/useConnectionStatus';
import { request } from '../lib/request';
import { errorMessage, type RequestErrorCode } from '../lib/errors';
import { Marquee } from '../components/Marquee';
import { Board } from '../components/Board';
import { PlayerSide } from '../components/PlayerSide';
import './GameScreen.css';

type Props = {
  status: ConnectionStatus;
  game: GameStatePayload;
  over: GameOverPayload | null;
  onLeft: () => void;
};

const STONE_LABEL: Record<Stone, string> = { black: '흑', white: '백' };
const DIRECTION_LABEL: Record<LineDirection, string> = {
  horizontal: '가로',
  vertical: '세로',
  diagonal: '대각선',
  'anti-diagonal': '대각선',
};

/**
 * 04 대국 · 내 차례 / 05 대국 · 상대 차례 (ux-spec 4장).
 * 착수는 모바일과 PC 모두 미리보기 후 [G7에 두기]로 확정해요.
 * 대국이 끝나면 3단계에서는 판에 승리 링과 간단한 결과만 보여줘요. 06 결과 시트와 재대결은 4단계예요.
 */
export const GameScreen = ({ status, game, over, onLeft }: Props) => {
  const me = game.you;
  const opponent = oppositeStone(me);
  const myTurn = !over && game.turn === me;
  const [preview, setPreview] = useState<Position | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<RequestErrorCode | null>(null);
  const [leaving, setLeaving] = useState(false);

  // 새 수가 오면(내가 뒀든 상대가 뒀든) 고른 자리를 지워요.
  useEffect(() => {
    setPreview(null);
    setError(null);
  }, [game.moveCount]);

  const handlePlace = async () => {
    if (!preview) return;
    setPlacing(true);
    setError(null);
    const result = await request('game:move', preview);
    setPlacing(false);
    if (!result.ok) setError(result.error);
  };

  const handleLeave = async () => {
    setLeaving(true);
    await request('room:leave');
    onLeft();
  };

  const sideState = (stone: Stone) => {
    const color = STONE_LABEL[stone];
    if (over) return color;
    if (game.turn !== stone) return `${color} · 기다리는 중`;
    return stone === me ? `${color} · 내 차례` : `${color} · 두는 중`;
  };

  const last = game.lastMove;
  const lastLabel = last && `마지막 수 · ${game.players[last.stone].nickname} ${toCoordinateLabel(last)}`;
  const opponentName = game.players[opponent].nickname;

  return (
    <div className="screen game">
      <Marquee status={status} trailing={<span className="t-body num game__count">{game.moveCount}수</span>}>
        <h1 className="t-title marquee__grow">{game.hostNickname}의 방</h1>
      </Marquee>

      <main className="game__layout">
        <PlayerSide
          className="game__opponent"
          stone={opponent}
          nickname={opponentName}
          state={sideState(opponent)}
          lit={!over && game.turn === opponent}
          trailing={over ? <ResultStamp stone={opponent} over={over} /> : undefined}
        />

        <div className="game__board">
          <Board
            board={game.board}
            lastMove={last}
            preview={myTurn ? preview : null}
            previewStone={me}
            winningLine={over?.winningLine ?? null}
            interactive={myTurn && !placing}
            onPick={(pos) => {
              setPreview(pos);
              setError(null);
            }}
          />
        </div>

        <p className="t-title game__vs" aria-hidden="true">
          VS
        </p>

        <PlayerSide
          className="game__me"
          stone={me}
          nickname={game.players[me].nickname}
          state={sideState(me)}
          lit={myTurn}
          trailing={over ? <ResultStamp stone={me} over={over} /> : undefined}
        />

        <section className="game__dock" aria-live="polite">
          {over ? (
            <OverSummary over={over} me={me} opponentName={opponentName} leaving={leaving} onLeave={() => void handleLeave()} />
          ) : myTurn ? (
            <>
              <div className="legend t-body muted">
                <span>
                  <i className="mk-last" />
                  상대의 마지막 수
                </span>
                <span>
                  <i className="mk-pick" />
                  내가 고른 위치
                </span>
              </div>
              {error && (
                <p className="t-body field__error" role="alert">
                  {errorMessage(error)}
                </p>
              )}
              <p className="t-body">
                {preview ? (
                  <>
                    고른 자리 <b className="t-title accent">{toCoordinateLabel(preview)}</b> · 다른 곳을 누르면 옮겨져요
                  </>
                ) : (
                  '판에서 둘 자리를 골라요'
                )}
              </p>
              <div className="game__actions">
                <button className="btn btn--ghost" type="button" onClick={() => setPreview(null)} disabled={!preview || placing}>
                  취소
                </button>
                <button
                  className="btn btn--coin game__place"
                  type="button"
                  onClick={() => void handlePlace()}
                  disabled={!preview || placing || status !== 'connected'}
                  aria-busy={placing}
                >
                  {preview ? `${toCoordinateLabel(preview)}에 두기` : '자리를 골라요'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="t-title game__waiting">
                <span className="lampdot blink" aria-hidden="true" />
                {opponentName} 님이 두고 있어요
              </p>
              {lastLabel && (
                <p className="t-body muted game__last">
                  <i className="mk-last" />
                  {lastLabel}
                </p>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
};

const ResultStamp = ({ stone, over }: { stone: Stone; over: GameOverPayload }) => {
  if (over.winner === null) return <span className="stamp stamp--muted">무승부</span>;
  const won = over.winner === stone;
  const onPaper = stone === 'white';
  const className = won ? 'stamp stamp--lamp' : onPaper ? 'stamp stamp--ink' : 'stamp';
  return <span className={className}>{won ? '승리' : '패배'}</span>;
};

/**
 * 3단계의 임시 결과 표시예요. 06 결과 시트(재대결 포함)는 4단계에서 이 자리를 대신해요.
 */
const OverSummary = ({
  over,
  me,
  opponentName,
  leaving,
  onLeave,
}: {
  over: GameOverPayload;
  me: Stone;
  opponentName: string;
  leaving: boolean;
  onLeave: () => void;
}) => {
  const won = over.winner === me;
  const title =
    over.winner === null
      ? '비겼어요'
      : over.reason === 'left'
        ? `${opponentName} 님이 방을 나가서 이겼어요`
        : over.reason === 'disconnect'
          ? `${opponentName} 님의 연결이 끊겨서 이겼어요`
          : won
            ? '승리했어요'
            : '졌어요';
  const summary =
    over.reason === 'five' && over.winningLine && over.winner
      ? `${STONE_LABEL[over.winner]} ${DIRECTION_LABEL[over.winningLine.direction]} 5목 완성 · 총 ${over.moveCount}수`
      : over.reason === 'draw'
        ? `판이 가득 찼어요 · 총 ${over.moveCount}수`
        : `총 ${over.moveCount}수`;

  return (
    <>
      <div className="game__result">
        <p className={won ? 't-big accent' : 't-big'}>{title}</p>
        <p className="t-body muted">{summary}</p>
      </div>
      <button className="btn btn--ghost btn--wide" type="button" onClick={onLeave} disabled={leaving}>
        로비로 나가기
      </button>
    </>
  );
};

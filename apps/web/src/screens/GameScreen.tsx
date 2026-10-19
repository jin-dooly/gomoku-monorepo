import { useEffect, useState } from 'react';
import {
  oppositeStone,
  toCoordinateLabel,
  type GameOverPayload,
  type GameStatePayload,
  type Position,
  type RoomSummary,
  type Stone,
} from '@gomoku/shared';
import type { ConnectionStatus } from '../hooks/useConnectionStatus';
import { formatClock, useCountdown } from '../hooks/useCountdown';
import { request } from '../lib/request';
import { errorMessage, type RequestErrorCode } from '../lib/errors';
import { Marquee } from '../components/Marquee';
import { Board } from '../components/Board';
import { PlayerSide } from '../components/PlayerSide';
import { GameMenu } from '../components/GameMenu';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ResultSheet, type OpponentGone } from '../components/ResultSheet';
import { OpponentAwayDialog } from '../components/OpponentAwayDialog';
import { RulesDialog } from '../components/RulesDialog';
import './GameScreen.css';

type Props = {
  status: ConnectionStatus;
  game: GameStatePayload;
  over: GameOverPayload | null;
  /** 방장이면 상대가 나갔을 때 대기실로 돌아갈 수 있어요. */
  isHost: boolean;
  /** 재대결을 요청한 사람의 이번 판 색 */
  rematch: Stone[];
  /** 결과 화면에서 상대가 나갔거나 연결이 끊겼어요 (opponent:left). */
  opponentLeft: OpponentGone | null;
  /** 상대 연결이 끊겨 기다리는 중이면 30초 유예가 끝나는 시각 (07) */
  opponentAway: number | null;
  onLeft: () => void;
  onReopened: (room: RoomSummary) => void;
};

const STONE_LABEL: Record<Stone, string> = { black: '흑', white: '백' };
const GONE_LABEL: Record<OpponentGone | 'resign', string> = {
  resign: '기권',
  left: '방을 나감',
  disconnect: '연결 끊김',
};

type Confirming = 'resign' | 'leave' | null;

/**
 * 04 대국 · 내 차례 / 05 대국 · 상대 차례 / 06 결과 · 재대결 (ux-spec 4장).
 * 착수는 모바일과 PC 모두 미리보기 후 [G7에 두기]로 확정해요.
 * 두는 동안에만 ⋮ 메뉴(08 시트 · 10 드롭다운)가 있고, 기권과 나가기는 09 확인창을 거쳐요.
 */
export const GameScreen = ({ status, game, over, isHost, rematch, opponentLeft, opponentAway, onLeft, onReopened }: Props) => {
  const me = game.you;
  const opponent = oppositeStone(me);
  const myTurn = !over && game.turn === me;
  const connected = status === 'connected';
  const away = opponentAway !== null;
  const awayLeft = useCountdown(opponentAway ?? 0);
  /** 07 대화상자에서 [계속 기다리기]를 눌렀어요. 상대가 다시 끊기면 새로 보여줘요. */
  const [awayDismissed, setAwayDismissed] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [preview, setPreview] = useState<Position | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<RequestErrorCode | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<RequestErrorCode | null>(null);

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

  useEffect(() => setAwayDismissed(false), [opponentAway]);

  // 판이 끝나면 열려 있던 확인창은 닫아요 (예: 확인하는 사이 상대가 5목을 완성).
  useEffect(() => {
    if (over) setConfirming(null);
  }, [over]);

  const handleConfirm = async () => {
    if (!confirming) return;
    setConfirmBusy(true);
    setConfirmError(null);
    if (confirming === 'leave') {
      // 대국 중에 나가면 서버가 기권으로 처리해요.
      await request('room:leave');
      onLeft();
      return;
    }
    const result = await request('game:resign');
    setConfirmBusy(false);
    if (result.ok) setConfirming(null);
    else setConfirmError(result.error);
  };

  const openConfirm = (kind: Confirming) => {
    setConfirmError(null);
    setConfirming(kind);
  };

  // 상대가 나간 이유: 두는 중에 나가면 game:over의 reason, 결과 화면에서 나가면 opponent:left
  const opponentGone: OpponentGone | null =
    opponentLeft ?? (over?.reason === 'left' || over?.reason === 'disconnect' ? over.reason : null);

  const sideState = (stone: Stone) => {
    const color = STONE_LABEL[stone];
    if (stone === opponent && away) return `${color} · 연결 끊김 ${formatClock(awayLeft)}`;
    if (over) {
      if (stone === opponent && opponentGone) return `${color} · ${GONE_LABEL[opponentGone]}`;
      if (over.reason === 'resign' && over.winner !== stone) return `${color} · ${GONE_LABEL.resign}`;
      return color;
    }
    if (game.turn !== stone) return `${color} · 기다리는 중`;
    return stone === me ? `${color} · 내 차례` : `${color} · 두는 중`;
  };

  const last = game.lastMove;
  const lastLabel = last && `마지막 수 · ${game.players[last.stone].nickname} ${toCoordinateLabel(last)}`;
  const opponentName = game.players[opponent].nickname;

  return (
    <div className="screen game">
      <Marquee
        status={status}
        trailing={
          <>
            <span className="t-body num game__count">{game.moveCount}수</span>
            {!over && (
              <GameMenu
                onResign={() => openConfirm('resign')}
                onLeave={() => openConfirm('leave')}
                onRules={() => setRulesOpen(true)}
              />
            )}
          </>
        }
      >
        <h1 className="t-title marquee__grow">{game.hostNickname}의 방</h1>
      </Marquee>

      <main className={over ? 'game__layout game__layout--over' : 'game__layout'}>
        <PlayerSide
          className={away ? 'game__opponent side--gone' : 'game__opponent'}
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
            interactive={myTurn && !placing && connected}
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

        <section className={over ? 'game__dock game__dock--result' : 'game__dock'} aria-live="polite">
          {over ? (
            <ResultSheet
              over={over}
              me={me}
              opponentName={opponentName}
              isHost={isHost}
              rematch={rematch}
              opponentGone={opponentGone}
              opponentAwayMs={away ? awayLeft : null}
              onLeft={onLeft}
              onReopened={onReopened}
            />
          ) : !connected ? (
            <p className="t-title game__waiting">
              <span className="lampdot lampdot--off blink" aria-hidden="true" />
              연결이 끊겨서 다시 연결하고 있어요
            </p>
          ) : myTurn ? (
            <>
              {/* 화면 낭독기: 차례가 넘어오면 상대가 어디에 뒀는지 함께 읽어요 */}
              <p className="sr-only">내 차례예요{lastLabel ? ` · ${lastLabel}` : ''}</p>
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

      {rulesOpen && (
        <RulesDialog
          onClose={() => setRulesOpen(false)}
          liveStatus={
            // 규칙을 보는 동안에도 실시간 상태를 숨기지 않아요 (ux-spec 11)
            away ? (
              <>
                <span className="lampdot lampdot--off blink" aria-hidden="true" />
                <span className="low">
                  {opponentName} 님의 연결이 끊겼어요 {formatClock(awayLeft)}
                </span>
              </>
            ) : myTurn ? (
              <>
                <span className="lampdot blink" aria-hidden="true" />
                <span className="accent">내 차례예요</span>
              </>
            ) : over ? undefined : (
              <>
                <span className="lampdot lampdot--off" aria-hidden="true" />
                <span className="muted">{opponentName} 님이 두고 있어요</span>
              </>
            )
          }
        />
      )}
      {away && !over && !awayDismissed && !confirming && !rulesOpen && (
        <OpponentAwayDialog
          opponentName={opponentName}
          myName={game.players[me].nickname}
          remainingMs={awayLeft}
          onWait={() => setAwayDismissed(true)}
          onLeave={() => openConfirm('leave')}
        />
      )}
      {confirming === 'resign' && (
        <ConfirmDialog
          title="기권할까요?"
          description={`이번 판은 ${opponentName} 님의 승리로 끝나요. 결과 화면에서 재대결을 요청할 수 있어요.`}
          cancelLabel="계속 두기"
          confirmLabel="기권하기"
          busy={confirmBusy}
          error={confirmError && errorMessage(confirmError)}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void handleConfirm()}
        />
      )}
      {confirming === 'leave' && (
        <ConfirmDialog
          title="방에서 나갈까요?"
          description="대국 중에 나가면 기권으로 처리돼요."
          cancelLabel="계속 두기"
          confirmLabel="기권하고 나가기"
          busy={confirmBusy}
          error={confirmError && errorMessage(confirmError)}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void handleConfirm()}
        />
      )}
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

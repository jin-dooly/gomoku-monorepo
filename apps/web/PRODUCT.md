# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Friends playing casually.** People who know each other open the site, one creates a room, the other joins, and they play a quick real-time game of Gomoku (오목). Sessions are short and social: start fast, play, rematch.
- **Portfolio reviewers.** The project also exists to demonstrate the author's real-time frontend and backend craft (a frontend developer). Reviewers judge it by how polished, responsive, and reliable it feels in actual use.

Both audiences matter equally: a reviewer should experience exactly what a friend playing a real game experiences.

## Product Purpose

A two-player, real-time online Gomoku game in the browser. No install and, for now, no account: you enter a nickname, then create or join a room. Success means two people can get from opening the site to placing their first stone in seconds, play without lag or ambiguity about whose turn it is, and rematch without friction.

## Positioning

A small, focused, well-crafted real-time game rather than a feature-heavy game portal: host-approved rooms between people who chose to play each other, with no ads, accounts, or matchmaking clutter in the way.

## Operating Context

- Played on **mobile and desktop equally**. A 15×15 board must be fully playable on a phone screen as well as on a PC.
- Real-time over WebSockets (Socket.IO). Players can lose their connection, especially on mobile, so reconnection is part of normal use.
- Agreed room flow:
  - Home: nickname input, "방 만들기", and a room list. No invite codes.
  - The room name is the host's nickname. Duplicate nicknames are allowed. List rows show the creation time to the second (e.g. `2026.10.18 14:32:07 생성`).
  - Rooms in play show a "대국 중" chip and can't be joined.
  - A guest sends a join request and the host must accept ("수락하고 시작"). Accepting one request auto-rejects the others.
  - Join requests auto-cancel after 60s without a host response.
  - The host plays black and moves first. Rematch swaps colors.
  - If the opponent disconnects, the game waits 30s for them to reconnect.

## Capabilities and Constraints

- Rules: 15×15 board, five or more in a row wins (freestyle, so overlines count). No renju restrictions.
- Stack: pnpm + Turborepo monorepo. React 18 + TypeScript + Vite (web), NestJS + Socket.IO (server), and a shared Zod/types package (`@gomoku/shared`). The web app deploys to Vercel and the server to Render.
- Current server state: one global game in `GameService`. The multi-room flow above still needs server work (rooms, request/accept/reject/cancel events, timers).
- Language: **Korean only**. No i18n planned.
- Planned: **accounts / login** for persistent identity (design not yet decided).
- Out of scope for now: rankings and match history, AI opponent, spectating, in-room chat.

## Brand Commitments

- Product name in use: "오목 게임" (page title "Gomoku Game"). No logo or other brand assets exist yet.
- Visual world: pixel-art "2P arcade versus" (black/white faction panels, a cyan turn lamp, yellow reserved for pressable controls), set in the Galmuri pixel font. Values live in `docs/ux-spec.md` §5; the mockup is https://claude.ai/artifact/BTsJtEEcTz7gAi2ADuFwDD

## Evidence on Hand

- No real users, testimonials, stats, or press. Future work must not fabricate player counts, ratings, reviews, or activity.
- Room-flow wireframes: https://claude.ai/artifact/JgydUTX1vGzZJSU82yRtEp

## Product Principles

1. **Seconds to first stone.** Every step between opening the site and playing should earn its place.
2. **Never ambiguous.** Whose turn it is, which color you are, connection status, and what happened to a request should always be obvious.
3. **Real-time must feel real.** Moves, requests, timeouts, and disconnects should show up immediately and honestly, never silently.
4. **Phone and desktop are equals.** A feature isn't done until it plays well on both.
5. **Craft is the showcase.** Polish and reliability count as features, because the build is also the portfolio piece.

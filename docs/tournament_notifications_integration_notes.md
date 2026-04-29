# Tournament + Notifications Integration Notes

## Purpose

This document records the integration work done on top of the working Tournament 5 branch so future merges into `develop` can be resolved with full context.

Main goals of this integration:

- keep the **working tournament flow**
- keep the **working remote multiplayer flow**
- restore compatibility with the **new notification / invite system**
- document **why each critical change was necessary**
- reduce risk when merging `187-back-tournament-5---matchmaking` into `develop`

---

## Branch context

### Functional base used for integration
The integration work was based on the working tournament branch state:

- `82d203d` - game fixes
- `76c80db` - return tournament matches to tournament page and improve matches layout
- `4a3b0fd` - add goal stats to leaderboard and fix active join state

### Why integration was needed
`develop` introduced a new notification / invite architecture, but that work overlapped with shared gameplay files.  
A direct merge caused regressions in:

- remote multiplayer waiting room
- tournament websocket flow
- game start synchronization
- passing player ids and match ids across pages

This was **not a conceptual conflict**.  
It was an **implementation conflict in shared files**.

---

## High-level conclusion

There is no product-level conflict between **Tournament** and **Notifications**.

The correct architecture is:

- **tournament flow controls the game**
- **notifications observe and surface events**
- **invite UI should not replace core tournament logic**
- **waiting room must always receive enough state to identify both players**

The main integration principle used was:

- keep **Tournament / waiting-room / game session logic** from the tournament branch
- bring **notification infrastructure and invite UI** from `develop`
- manually reconcile shared files

---

## Critical files changed and why

## 1. `src/backend/game-service/ws/router.py`

### Why this file is critical
This file is the shared backend entry point for:

- remote multiplayer game websocket
- waiting room ready flow
- tournament websocket flow

### What was wrong after merging with `develop`
`develop` brought websocket logging and notification-related improvements, but it did **not preserve the tournament websocket route** and the original waiting-room protocol diverged from the working tournament flow.

That caused regressions such as:

- missing `/ws/tournament/{tournament_id}`
- tournament ready flow breaking
- `match_start` not being emitted correctly for tournament matches
- waiting-room behavior becoming inconsistent

### What was kept from the tournament branch
The following behavior had to remain authoritative:

- `/ws/tournament/{tournament_id}`
- tournament `ready` / `unready` tracking
- tournament `match_start` emission
- waiting room support for `existing_match_id`
- `_ensure_game_session(...)`
- `_waiting_room_ready`
- `_waiting_room_players`
- `_tournament_ready`
- `_tournament_waiting_rooms`

### What was reintroduced from `develop`
Useful non-breaking parts from `develop` were preserved where possible:

- websocket logging / observability
- safer healthcheck handling
- compatibility with internal/test connection patterns

### Final reason for this change
This file had to become the place where:

- tournament flow remains functional
- remote multiplayer still starts correctly
- new notification-related observability does not break gameplay

---

## 2. `src/frontend/src/pages/Tournament.jsx`

### Why this file changed
The original issue description assumed bracket progression, but the real implementation moved to a round-robin / points-based tournament.

### What was changed
- replaced bracket-like match display with a more generic matches layout
- kept websocket handling for tournament-specific events:
  - `match_player_ready`
  - `match_player_unready`
  - `match_start`
  - `tournament_updated`
  - `tournament_complete`
- preserved navigation to waiting room with all required state:
  - `player1_id`
  - `player2_id`
  - `matchId`
  - `tournamentId`
  - `tournamentMatchId`

### Why it matters
Tournament flow depends on this page forwarding enough state so the waiting room and `GamePage` can:

- start the correct match
- submit the result correctly
- return to the tournament page after game end

---

## 3. `src/frontend/src/pages/GamePage.jsx`

### Why this file changed
After a tournament match ended, the flow incorrectly returned players to the arena or failed to persist the tournament result.

### Root cause
The frontend was using the wrong id when submitting the result back to the tournament endpoint.

### Fix applied
- use `matchId` for tournament result submission
- preserve `tournamentId`
- navigate back to `/tournaments/:id` after successful match completion

### Why it matters
Without this fix:

- results were not saved into the tournament
- the same matches repeated
- tournament standings never advanced

---

## 4. `src/backend/game-service/persistence.py`

### Why this file changed
Tournament leaderboard needed access to actual match scores.

### Changes applied
- exposed `score_p1` and `score_p2` together with tournament match data
- fixed the participant loading bug in `get_tournament_with_participants(...)`
- preserved tournament match retrieval and scoring logic

### Why it matters
Without these changes:

- leaderboard could not show goals for / against / difference
- tournament detail API could break if participants were not loaded correctly

---

## 5. `src/backend/game-service/schemas.py`

### Why this file changed
Tournament match API responses needed score fields.

### Changes applied
Added to `TournamentMatchResponse`:

- `score_p1`
- `score_p2`

### Why it matters
These values are needed by the frontend to calculate:

- GF (Goals For)
- GA (Goals Against)
- GD (Goal Difference)

---

## 6. `src/frontend/src/pages/Tournaments.jsx`

### Why this file changed
Completed tournaments were still shown as if the player was actively joined.

### Root cause
UI was treating:
- "user participated in this tournament"
as the same thing as:
- "user is still actively joined in an open/in-progress tournament"

### Fix applied
Only treat a user as actively joined if tournament status is:

- `open`
- `in_progress`

### Why it matters
Without this fix:

- completed tournaments stayed marked as joined
- users saw incorrect active tournament restrictions
- UI became inconsistent even though backend logic was already correct

---

## 7. `src/frontend/src/Components/FriendsSidebar.jsx`

### Why this file changed
After notification-related code was brought from `develop`, normal invites could open the waiting room with incomplete state.

### Root cause
`navigateToWaitingRoom(...)` did not always pass:

- `player1_id`
- `player2_id`

and ids were not always normalized before entering the waiting room.

### Fix applied
- normalize both player ids before navigation
- always pass:
  - `currentUser`
  - `opponent`
  - `friendId`
  - `friendUsername`
  - `player1_id`
  - `player2_id`
- protect game-channel opening with `auth?.access_token`
- clean up minor robustness issues

### Why it matters
Without this fix one side could enter waiting room correctly while the other got:

- `Missing player ids for this room.`

and could not click **Ready**.

---

## 8. `src/frontend/src/Components/GameInviteModal.jsx`

### Why this file changed
The second major invite path (global modal) was still navigating to the waiting room with incomplete state.

### Root cause
This component was using unresolved or incorrect current user data and not consistently passing:

- `player1_id`
- `player2_id`

It also still referenced `user` in places where the resolved authenticated user was no longer guaranteed.

### Fix applied
- resolve current user via `/api/users/auth/me`
- build waiting-room state with numeric ids
- always pass:
  - `currentUser`
  - `opponent`
  - `friendId`
  - `friendUsername`
  - `player1_id`
  - `player2_id`
- clean up modal close/error behavior

### Why it matters
Without this fix:
- one player could become ready
- the other could appear ready locally but send incorrect data
- backend never emitted `game_start`
- multiplayer would get stuck in:
  - `Both players are ready. Waiting for backend game_start event...`

---

## Scoreboard / Leaderboard changes

## Goal-based leaderboard
Tournament leaderboard was updated to compute:

- points
- wins
- matches played
- goals for
- goals against
- goal difference

### Reason
The tournament now behaves like a points-based competition rather than a simple bracket.

### Sorting logic
Ranking uses:

1. points
2. goal difference
3. goals scored
4. wins
5. username fallback

### Why it matters
This made the leaderboard usable for tie-breaks and consistent with the new tournament format.

---

## Remote multiplayer issue that was solved

## Symptom
One player would see:
- `You are ready. Waiting for the other player...`

The other player would see:
- `Both players are ready. Waiting for backend game_start event...`

but the game never started.

## Actual root cause
The two players were not always entering the waiting room through the same fully compatible path.

One path had correct numeric ids.  
Another path had incomplete or unresolved ids.

That caused:
- frontend local state to look ready
- backend to reject or ignore the second `player_ready`
- `game_start` never being emitted

## Resolution
Fix both invite entry points:

- `FriendsSidebar.jsx`
- `GameInviteModal.jsx`

so both always navigate with the same complete waiting-room state.

---

## Tournament-specific issue that was solved

## Symptom
Tournament matches could finish but:
- redirect to arena instead of tournament
- result was not recorded
- leaderboard did not update
- repeated matches could appear

## Root cause
`GamePage.jsx` was using the wrong id when submitting match results to the tournament backend.

## Resolution
Use the correct `matchId`, preserve tournament state, and navigate back to `/tournaments/:id`.

---

## Test results after fixes

The following was manually validated as working:

### Remote multiplayer
- invite is sent
- recipient accepts
- both users reach waiting room
- both can click **Ready**
- backend emits `game_start`
- match starts correctly

### Tournament
- tournament page loads
- match ready flow works
- waiting room opens correctly
- match starts
- result is persisted
- players return to tournament page after game end
- leaderboard updates
- completed tournaments no longer appear as actively joined

---

## Files most likely to conflict when merging `187` into `develop`

These files should be reviewed manually during the future merge:

### Highest risk
- `src/backend/game-service/ws/router.py`
- `src/frontend/src/pages/GameWaitingRoom.jsx`
- `src/frontend/src/Components/FriendsSidebar.jsx`
- `src/frontend/src/Components/GameInviteModal.jsx`

### Medium risk
- `src/frontend/src/App.jsx`
- `src/backend/shared/ws/manager.py`
- `src/frontend/src/context/notificationContext.jsx`

---

## Merge strategy recommendation for the future

When merging `187-back-tournament-5---matchmaking` into `develop`:

### Prefer this rule
- **Tournament / game flow logic stays authoritative from `187`**
- **Notification infrastructure stays from `develop` where compatible**
- **Shared files must be resolved manually**
- **No blind auto-merge for websocket and waiting room files**

### In practice
For shared files, preserve:
- gameplay protocol
- tournament websocket route
- correct id propagation into waiting room
- correct tournament result submission

Then layer on:
- logging
- notification UI
- event-driven notification infrastructure

---

## Final architecture guidance

The safest long-term interpretation is:

- **Notifications are supportive UI / signaling**
- **Tournament and remote game flow are authoritative gameplay control**
- **Waiting room requires canonical numeric ids from all entry points**
- **Every navigation to `/game/waiting/:roomId` must pass enough state to identify both players**

If this rule is respected, both systems can coexist without regressions.

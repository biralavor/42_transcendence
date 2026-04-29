

## Context

This document records the tournament direction discussed by the team on **2026-04-08**.

The main goal is to keep the feature **simple, resilient, and easier to implement**, especially compared with a full bracket flow with semifinals/finals for different player counts.

This proposal is intentionally pragmatic: prefer a tournament model that works well with player availability, disconnects, and incremental delivery.

## Current direction

### 1) Tournament format

The preferred model is **round-robin / points-based tournament** instead of single elimination.

Why:
- simpler to reason about than brackets with semifinals/finals
- works better with different participant counts
- is more resilient to player drop-off during the tournament
- allows a clearer tournament leaderboard during the event

### 2) Tournament leaderboard

Each tournament should have its **own leaderboard**, showing at least:
- matches played
- wins
- points
- ranking

This makes tournament progression easier to understand than a changing bracket for the current team scope.

### 3) Optional final match

If the team wants a "final" for excitement, the simplest version is:
- run the tournament in points format first
- at the end, **1st place vs 2nd place** can play a final match

This is optional and can be added later.

## Recommended functional rules

### 4) Number of participants

When creating a tournament, the creator chooses a participant limit.

Suggested range for now:
- **3 to 8 players**

This keeps the feature controlled and realistic for the current scope.

### 5) One active tournament per player

A player should be allowed to participate in **only one active tournament at a time**.

Why:
- avoids conflicting schedules
- simplifies matchmaking
- simplifies tournament state management
- makes it easier to send the user directly to the tournament flow when it starts

### 6) Tournament start condition

The tournament should only start when the configured number of participants has been reached.

At that point, the system can:
- mark the tournament as ready to start
- direct participants to the tournament page / waiting flow

This is simpler than depending on a notification-heavy flow from the start.

## Matchmaking and match flow

### 7) Matchmaking model

The backend should manage pending pairings for the tournament and create matches between players who:
- are available
- still need to face each other according to the tournament schedule

A good practical rule is:
- among the available players, prioritize pairings that still need to happen
- if useful later, prefer players with closer/current tournament ranking

This follows the spirit of the team discussion and keeps room for future refinement.

### 8) Waiting room after each match

After finishing a match, the player should return to a **tournament waiting room**.

From there:
- the player can see tournament status
- the player waits for the next opponent/match assignment
- the player can confirm readiness when needed

### 9) Ready flow

Suggested simple flow:
- when the backend identifies the next valid pairing, both players are sent to the waiting room for that match
- both players confirm **Ready**
- when both are ready, the match starts

This keeps the flow explicit and easy to understand.

### 10) If one player finishes earlier than the other

If a player becomes available before the next opponent:
- that player remains in the tournament waiting room
- the backend keeps checking for the next valid pairing
- once the opponent becomes available and the match is defined, both players are directed to the same waiting room / ready flow

So the player who finishes first waits in the tournament context, not in a "dead" state.

## Behavior in practice

### 11) Practical backend expectation

In simple terms, the backend should:
- track who is still active in the tournament
- know which matches are still pending
- know which players are available right now
- create the next valid match when conditions are met
- send both players into the ready flow for that match

This avoids hard-coding a rigid sequence when there are still other valid games that can happen.

### 12) Resilience to drop-off / abandonment

One advantage of the points-based model is that it handles abandonment better than strict elimination.

If a player disconnects, abandons, or becomes unavailable, the tournament can still continue more naturally for the remaining players than in a fragile bracket structure.

## Recommended first version

To keep delivery realistic, the first version should focus on:
- points-based tournament
- creator chooses participant limit
- one active tournament per player
- tournament starts only when full
- tournament-specific leaderboard
- backend pairing of available players with pending matches
- waiting room + ready confirmation before each match

## Open points to validate later

These points came up in discussion but were not fully decided yet:

### Goals to win each match
- Should tournament creation allow custom goals-to-win?
- Simpler first version: keep the normal/default match rule.

### Notifications
- If all players are not already on the tournament page when the tournament fills, a notification flow may be needed.
- Simpler first version: when possible, direct users into the tournament flow once the tournament is ready.

### Final match
- Optional top-2 final can be discussed later.
- Not required for the first functional version.

## Note about existing project docs

At the time of writing, some project docs/milestone notes still mention **bracket / single elimination**.

This file should be understood as a **working functional premise** based on the latest team discussion, intended to help implementation move in the same direction.

If the team confirms this approach, the older milestone wording can be updated later for consistency.

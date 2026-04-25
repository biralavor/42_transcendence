import { describe, expect, it } from 'vitest'
import { buildTournamentStandings, getTournamentChampionId } from './tournamentStandings'

describe('tournamentStandings', () => {
  it('chooses the completed round-robin champion from standings, not the last match', () => {
    const tournament = {
      status: 'complete',
      participants: [
        { user_id: 1 },
        { user_id: 2 },
        { user_id: 3 },
      ],
      matches: [
        { status: 'finished', player1_id: 1, player2_id: 2, winner_id: 1, score_p1: 7, score_p2: 3 },
        { status: 'finished', player1_id: 1, player2_id: 3, winner_id: 1, score_p1: 7, score_p2: 4 },
        { status: 'finished', player1_id: 2, player2_id: 3, winner_id: 3, score_p1: 2, score_p2: 7 },
      ],
    }

    expect(getTournamentChampionId(tournament)).toBe(1)
    expect(buildTournamentStandings(tournament)[0]).toMatchObject({
      userId: 1,
      wins: 2,
      matches: 2,
    })
  })
})

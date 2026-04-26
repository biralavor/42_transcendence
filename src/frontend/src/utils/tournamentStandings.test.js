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

  it('normalizes mixed string/number IDs from participants and matches', () => {
    const tournament = {
      status: 'complete',
      participants: [
        { user_id: '1' },
        { user_id: 2 },
      ],
      matches: [
        { status: 'finished', player1_id: 1, player2_id: '2', winner_id: '2', score_p1: '3', score_p2: 5 },
      ],
    }

    const standings = buildTournamentStandings(tournament)

    expect(standings).toHaveLength(2)
    expect(standings[0]).toMatchObject({ userId: 2, wins: 1, matches: 1, goalsFor: 5, goalsAgainst: 3 })
    expect(standings[1]).toMatchObject({ userId: 1, wins: 0, matches: 1, goalsFor: 3, goalsAgainst: 5 })
    expect(getTournamentChampionId(tournament)).toBe(2)
  })
})

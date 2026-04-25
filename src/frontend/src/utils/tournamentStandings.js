export function buildTournamentStandings(tournament, profiles = {}) {
  if (!tournament || !Array.isArray(tournament.participants)) return []

  const stats = {}

  tournament.participants.forEach(({ user_id }) => {
    stats[user_id] = {
      userId: user_id,
      wins: 0,
      matches: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    }
  })

  if (Array.isArray(tournament.matches)) {
    tournament.matches.forEach((match) => {
      if (match.status !== 'finished') return

      const p1Id = match.player1_id
      const p2Id = match.player2_id
      const p1Score = Number(match.score_p1 ?? 0)
      const p2Score = Number(match.score_p2 ?? 0)

      if (p1Id != null && stats[p1Id]) {
        stats[p1Id].matches += 1
        stats[p1Id].goalsFor += p1Score
        stats[p1Id].goalsAgainst += p2Score
      }

      if (p2Id != null && stats[p2Id]) {
        stats[p2Id].matches += 1
        stats[p2Id].goalsFor += p2Score
        stats[p2Id].goalsAgainst += p1Score
      }

      if (match.winner_id != null && stats[match.winner_id]) {
        stats[match.winner_id].wins += 1
      }
    })
  }

  return Object.values(stats)
    .map((entry) => {
      const profile = profiles[entry.userId] || {}

      return {
        userId: entry.userId,
        username: profile.username || `User ${entry.userId}`,
        avatarUrl: profile.avatarUrl || '/avatar_placeholder.jpg',
        wins: entry.wins,
        matches: entry.matches,
        goalsFor: entry.goalsFor,
        goalsAgainst: entry.goalsAgainst,
        goalDifference: entry.goalsFor - entry.goalsAgainst,
        points: entry.wins,
      }
    })
    .sort((a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      b.wins - a.wins ||
      a.username.localeCompare(b.username)
    )
}

export function getTournamentChampionId(tournament) {
  if (!tournament || tournament.status !== 'complete') return null
  const champion = buildTournamentStandings(tournament)[0]
  return champion?.userId ?? null
}

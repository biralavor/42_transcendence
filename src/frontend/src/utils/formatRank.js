export function formatRank(rank) {
  if (rank == null) return 'Rank —'
  return `Rank #${String(rank).padStart(2, '0')}`
}

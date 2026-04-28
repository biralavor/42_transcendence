import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import { apiCall } from '../utils/apiClient'
import './Search.css'

const PER_PAGE = 10

function emptySearchPage(query) {
  return {
    query,
    results: [],
    total: 0,
    page: 1,
    per_page: PER_PAGE,
  }
}

export default function Search() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q')?.trim() ?? ''
  const pageParam = searchParams.get('page')
  const currentPage = Number.parseInt(pageParam ?? '1', 10)
  const safePage = Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1
  const [inputValue, setInputValue] = useState(query)
  const [pageData, setPageData] = useState(emptySearchPage(query))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const effectivePerPage =
    Number.isFinite(pageData.per_page) && pageData.per_page > 0 ? pageData.per_page : PER_PAGE
  const lastPage = Math.max(1, Math.ceil((pageData.total || 0) / effectivePerPage))

  useEffect(() => {
    setInputValue(query)
  }, [query])

  useEffect(() => {
    if (!query) {
      setPageData(emptySearchPage(query))
      setError('')
      setLoading(false)
      return undefined
    }

    const controller = new AbortController()
    setLoading(true)
    setError('')

    apiCall(`/api/users/search?q=${encodeURIComponent(query)}&page=${safePage}&per_page=${PER_PAGE}&sort=username`, {
      signal: controller.signal,
      skipRefreshOn401: true,
    })
      .then(r => {
        if (!r.ok) throw new Error(`Search failed: ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (controller.signal.aborted) return
        setPageData({
          query,
          results: Array.isArray(data.results) ? data.results : [],
          total: Number.isFinite(data.total) ? data.total : 0,
          page: Number.isFinite(data.page) ? data.page : safePage,
          per_page: Number.isFinite(data.per_page) ? data.per_page : PER_PAGE,
        })
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setPageData(emptySearchPage(query))
          setError('Could not load user search results.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [query, safePage])

  const submitSearch = (event) => {
    event.preventDefault()
    const nextQuery = inputValue.trim()
    if (!nextQuery) return
    navigate(`/search?q=${encodeURIComponent(nextQuery)}&page=1`)
  }

  const goToPage = (page) => {
    if (!query) return
    navigate(`/search?q=${encodeURIComponent(query)}&page=${page}`)
  }

  return (
    <div className="arcade-shell">
      <NavbarComponent />
      <main className="arcade-content search-page">
        <section className="arcade-screen search-panel">
          <div className="search-header">
            <div>
              <span className="arcade-display mb-3">Find players</span>
              <h1 className="arcade-title mb-2">User search</h1>
            </div>
            <form className="search-form" role="search" onSubmit={submitSearch}>
              <input
                type="search"
                aria-label="Search users"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Search by username"
              />
              <button type="submit" className="arcade-btn arcade-btn-primary">
                Search
              </button>
            </form>
          </div>

          {!query && (
            <p className="search-status">Type a username to start searching.</p>
          )}
          {query && loading && (
            <p className="search-status">Loading results...</p>
          )}
          {query && !loading && error && (
            <p className="search-status search-status--error">{error}</p>
          )}
          {query && !loading && !error && pageData.results.length === 0 && (
            <p className="search-status">No users found for "{query}".</p>
          )}

          {query && !loading && !error && pageData.results.length > 0 && (
            <>
              <div className="search-summary">
                {pageData.total} result{pageData.total === 1 ? '' : 's'} for "{query}"
              </div>
              <div className="search-results" aria-label="User search results">
                {pageData.results.map(user => (
                  <Link key={user.id} to={`/profile/${user.id}`} className="search-result-row">
                    <img
                      src={user.avatar_url || '/avatar_placeholder.jpg'}
                      alt=""
                      className="search-result-avatar"
                    />
                    <span className="search-result-username">@{user.username}</span>
                  </Link>
                ))}
              </div>
              <div className="search-pagination" aria-label="Search results pagination">
                <button
                  type="button"
                  className="arcade-btn arcade-btn-secondary"
                  disabled={pageData.page <= 1}
                  onClick={() => goToPage(pageData.page - 1)}
                >
                  Previous
                </button>
                <span>Page {pageData.page} of {lastPage}</span>
                <button
                  type="button"
                  className="arcade-btn arcade-btn-secondary"
                  disabled={pageData.page >= lastPage}
                  onClick={() => goToPage(pageData.page + 1)}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}

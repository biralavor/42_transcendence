import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Tournaments from './Tournaments'
import { apiCall, apiJson } from '../utils/apiClient'
import { getTournamentChampionId } from '../utils/tournamentStandings'

vi.mock('../utils/apiClient', () => ({
    apiCall: vi.fn(),
    apiJson: vi.fn(),
}))

vi.mock('../context/authContext', () => ({
    useAuth: () => ({ auth: { access_token: 'test-token' } }),
}))

vi.mock('../Components/Navbar', () => ({
    default: () => <div data-testid="navbar">Navbar</div>,
}))

vi.mock('../utils/tournamentStandings', () => ({
    getTournamentChampionId: vi.fn(),
}))

function mockOk(data) {
    return {
        ok: true,
        status: 200,
        json: async () => data,
    }
}

function renderTournamentsPage() {
    return render(
        <MemoryRouter initialEntries={['/tournaments']}>
            <Routes>
                <Route path="/tournaments" element={<Tournaments />} />
            </Routes>
        </MemoryRouter>,
    )
}

describe('Tournaments page action availability', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        apiJson.mockResolvedValue({})
        getTournamentChampionId.mockReturnValue(null)
    })

    it('disables Create and Join-by-ID controls when user is already in an active tournament', async () => {
        const tournaments = [
            {
                id: 101,
                name: 'Active Cup',
                status: 'open',
                creator_id: 1,
                max_participants: 8,
                participants: [{ user_id: 1 }],
                matches: [],
            },
        ]

        apiCall.mockImplementation(async (url) => {
            if (url === '/api/users/auth/me') return mockOk({ id: 1, username: 'alice' })
            if (url === '/api/game/tournaments') return mockOk(tournaments)
            throw new Error(`Unexpected URL in test: ${url}`)
        })

        renderTournamentsPage()

        const createButton = await screen.findByRole('button', { name: 'Create' })
        expect(createButton).toBeDisabled()

        const manualIdInput = screen.getByLabelText('Tournament ID')
        await userEvent.type(manualIdInput, '999')

        const joinByIdButton = screen.getByRole('button', { name: 'Join' })
        expect(joinByIdButton).toBeDisabled()
    })

    it('does not show row Join action for open tournaments when user has another active tournament', async () => {
        const tournaments = [
            {
                id: 201,
                name: 'My Active Tournament',
                status: 'in_progress',
                creator_id: 1,
                max_participants: 4,
                participants: [{ user_id: 1 }, { user_id: 2 }],
                matches: [],
            },
            {
                id: 202,
                name: 'Open Tournament',
                status: 'open',
                creator_id: 3,
                max_participants: 4,
                participants: [{ user_id: 3 }],
                matches: [],
            },
        ]

        apiCall.mockImplementation(async (url) => {
            if (url === '/api/users/auth/me') return mockOk({ id: 1, username: 'alice' })
            if (url === '/api/game/tournaments') return mockOk(tournaments)
            throw new Error(`Unexpected URL in test: ${url}`)
        })

        renderTournamentsPage()

        await screen.findByText('Open Tournament')

        const openRow = screen.getByText('Open Tournament').closest('tr')
        expect(openRow).toBeTruthy()
        expect(within(openRow).queryByRole('button', { name: 'Join' })).not.toBeInTheDocument()
    })

    it('loads champion profile when champion id comes as a string', async () => {
        const tournaments = [
            {
                id: 301,
                name: 'Completed Cup',
                status: 'complete',
                creator_id: 1,
                max_participants: 4,
                participants: [{ user_id: 1 }, { user_id: 7 }],
                matches: [],
            },
        ]

        getTournamentChampionId.mockReturnValue('7')

        apiCall.mockImplementation(async (url) => {
            if (url === '/api/users/auth/me') return mockOk({ id: 1, username: 'alice' })
            if (url === '/api/game/tournaments') return mockOk(tournaments)
            if (url === '/api/users/profile/7') {
                return mockOk({ id: 7, username: 'champion7', display_name: 'Champion Seven', avatar_url: null })
            }
            throw new Error(`Unexpected URL in test: ${url}`)
        })

        renderTournamentsPage()

        await waitFor(() => {
            expect(apiCall).toHaveBeenCalledWith('/api/users/profile/7')
        })

        expect(await screen.findByText('Champion Seven')).toBeInTheDocument()
    })
})

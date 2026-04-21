import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import GameWaitingRoom from './GameWaitingRoom'
import { decodeJWT } from '../utils/jwtUtils'
import * as wsClient from '../utils/wsClient'

// Mock modules
vi.mock('../utils/wsClient')
vi.mock('../utils/wsLogger', () => ({
    default: {
        connection: vi.fn(),
        receive: vi.fn(),
        send: vi.fn(),
        ready: vi.fn(),
        uiUpdate: vi.fn(),
        latency: vi.fn(),
        flowStart: vi.fn(() => Date.now()),
        flowEnd: vi.fn(),
        broadcast: vi.fn(),
    },
}))
vi.mock('../utils/jwtUtils')

// Mock useLocation hook to support location.state
let mockLocationState = {}
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return {
        ...actual,
        useLocation: vi.fn(() => ({
            pathname: '/game/waiting/invite-4-5-123',
            state: mockLocationState,
            hash: '',
            search: '',
            key: 'default',
        })),
    }
})

// Mock auth context
const mockAuthContext = {
    auth: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqb2FvIiwiY3JlZGVudGlhbF9pZCI6NCwiZXhwIjoxNzc2MDQzMTkwfQ.mock',
    },
    isAuthenticated: true,
    isAuthReady: true,
    login: vi.fn(),
    logout: vi.fn(),
}

vi.mock('../context/authContext', () => ({
    AuthContext: { Provider: () => null },
    useAuth: () => mockAuthContext,
    AuthProvider: ({ children }) => children,
}))

// Mock Navbar
vi.mock('../Components/Navbar', () => ({
    default: () => <div data-testid="navbar">Navbar</div>,
}))

/**
 * Helper to render GameWaitingRoom with proper routing setup.
 * Sets mockLocationState so useLocation() mock returns the provided state.
 * 
 * @param {string} roomId - The game room ID for the URL param
 * @param {object} locationState - The location.state to pass via navigation
 */
function renderWithRouter(roomId = '123', locationState = {}) {
    // Update the mocked useLocation to return this state
    mockLocationState = locationState

    return render(
        <MemoryRouter initialEntries={[{ pathname: `/game/waiting/${roomId}` }]}>
            <Routes>
                <Route path="/game/waiting/:roomId" element={<GameWaitingRoom />} />
                <Route path="/play" element={<div>Play page</div>} />
                <Route path="/tournaments/:id" element={<div>Tournament page</div>} />
            </Routes>
        </MemoryRouter>
    )
}

describe('GameWaitingRoom - Ready Message Sync', () => {
    let mockWs
    let wsConnectHandler
    let user

    beforeEach(async () => {
        user = userEvent.setup()

        mockWs = {
            send: vi.fn(),
            close: vi.fn(),
        }

        wsConnectHandler = {}

        wsClient.createWsClient = vi.fn((url, handlers) => {
            wsConnectHandler = handlers
            return mockWs
        })

        decodeJWT.mockReturnValue({
            sub: 'joao',
            credential_id: 4,
            exp: 1776043190,
        })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('User ID Extraction from Navigation State', () => {
        it('should extract user ID from navigate state (currentUser) for handleReady', async () => {
            const location = {
                state: {
                    currentUser: { id: 4, username: 'joao' },
                    opponent: { id: 5, username: 'maria' },
                },
            }

            renderWithRouter('invite-4-5-123', location.state)

            // Simulate WebSocket connection
            act(() => {
                wsConnectHandler.onOpen?.()
            })

            // Click ready button
            const readyButton = screen.getByText('Ready')
            await user.click(readyButton)

            // Verify payload contains user_id from navigation state
            expect(mockWs.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'player_ready',
                    user_id: 4, // From location.state.currentUser.id
                })
            )
        })

        it('should fail ready if currentUser not provided in navigation state', async () => {
            const location = { state: { opponent: { id: 5, username: 'maria' } } }

            renderWithRouter('invite-4-5-123', location.state)

            act(() => {
                wsConnectHandler.onOpen?.()
            })

            const readyButton = screen.getByText('Ready')
            await user.click(readyButton)

            // Should not send message
            expect(mockWs.send).not.toHaveBeenCalled()

            // Should show error message
            await waitFor(() => {
                expect(screen.getByText(/Error: User identification failed/)).toBeInTheDocument()
            })
        })
    })

    describe('Ready Message Routing - ID Matching', () => {
        it('should recognize opponent ready message by user_id', async () => {
            const location = {
                state: {
                    opponent: { id: 5, username: 'maria' },
                    currentUser: { id: 4, username: 'joao' },
                },
            }

            renderWithRouter('invite-4-5-123', location.state)

            act(() => {
                wsConnectHandler.onOpen?.()
            })

            // Simulate opponent ready message
            act(() => {
                wsConnectHandler.onMessage?.({
                    type: 'player_ready',
                    user_id: 5, // Maria's ID
                    username: 'maria',
                })
            })

            // Opponent should be marked as ready
            await waitFor(() => {
                expect(screen.queryByText('maria')).toBeInTheDocument()
                // Find the maria player card and check its status
                const playerCards = screen.getAllByText(/Player (one|two)/i).map(el => el.closest('article'))
                const mariaCard = playerCards.find(card => card?.textContent.includes('maria'))
                expect(mariaCard?.textContent).toMatch(/Ready/)
            })
        })

        it('should recognize current player ready message by user_id', async () => {
            const location = {
                state: {
                    opponent: { id: 5, username: 'maria' },
                    currentUser: { id: 4, username: 'joao' },
                },
            }

            renderWithRouter('invite-4-5-123', location.state)

            act(() => {
                wsConnectHandler.onOpen?.()
            })

            // Simulate current player's ready message (echo from server)
            act(() => {
                wsConnectHandler.onMessage?.({
                    type: 'player_ready',
                    user_id: 4, // João's ID (current)
                    username: 'joao',
                })
            })

            // Current should be marked as ready (check player card status)
            await waitFor(() => {
                const playerCards = screen.getAllByText(/Player (one|two)/i).map(el => el.closest('article'))
                const joaoCard = playerCards.find(card => card?.textContent.includes('joao'))
                expect(joaoCard?.textContent).toMatch(/Ready/)
            })
        })

        it('should handle string and number ID types', async () => {
            const location = {
                state: {
                    opponent: { id: '5', username: 'maria' }, // String ID in state
                    currentUser: { id: 4, username: 'joao' },
                },
            }

            renderWithRouter('invite-4-5-123', location.state)

            act(() => {
                wsConnectHandler.onOpen?.()
            })

            // Message with number ID from server
            act(() => {
                wsConnectHandler.onMessage?.({
                    type: 'player_ready',
                    user_id: 5, // Number from server
                    username: 'maria',
                })
            })

            // Should still match correctly (String('5') === String(5))
            await waitFor(() => {
                const playerCards = screen.getAllByText(/Player (one|two)/i).map(el => el.closest('article'))
                const mariaCard = playerCards.find(card => card?.textContent.includes('maria'))
                expect(mariaCard?.textContent).toMatch(/Ready/)
            })
        })

        it('should fallback to username if ID unavailable', async () => {
            const location = {
                state: {
                    opponent: { id: 'remote-player', username: 'maria' }, // Default fallback ID
                    currentUser: { id: 'local-player', username: 'joao' },
                },
            }

            renderWithRouter('invite-4-5-123', location.state)

            act(() => {
                wsConnectHandler.onOpen?.()
            })

            // Message with no user_id
            act(() => {
                wsConnectHandler.onMessage?.({
                    type: 'player_ready',
                    username: 'maria', // Only username available
                })
            })

            // Should match by username
            await waitFor(() => {
                const playerCards = screen.getAllByText(/Player (one|two)/i).map(el => el.closest('article'))
                const mariaCard = playerCards.find(card => card?.textContent.includes('maria'))
                expect(mariaCard?.textContent).toMatch(/Ready/)
            })
        })
    })

    describe('Bidirectional Ready Sync', () => {
        it('should handle complete bidirectional ready flow', async () => {
            const location = {
                state: {
                    opponent: { id: 5, username: 'maria' },
                    currentUser: { id: 4, username: 'joao' },
                },
            }

            renderWithRouter('invite-4-5-123', location.state)

            act(() => {
                wsConnectHandler.onOpen?.()
            })

            // Step 1: João sends ready
            const readyButton = screen.getByText('Ready')
            await user.click(readyButton)

            expect(mockWs.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'player_ready',
                    user_id: 4,
                })
            )

            // Step 2: Server echoes João's ready
            act(() => {
                wsConnectHandler.onMessage?.({
                    type: 'player_ready',
                    user_id: 4,
                    username: 'joao',
                })
            })

            await waitFor(() => {
                expect(screen.getByText(/You are ready/)).toBeInTheDocument()
            })

            // Step 3: Maria sends ready
            act(() => {
                wsConnectHandler.onMessage?.({
                    type: 'player_ready',
                    user_id: 5,
                    username: 'maria',
                })
            })

            // Both should be ready now
            await waitFor(() => {
                expect(screen.getByText(/Both players are ready/)).toBeInTheDocument()
            })
        })
    })

    describe('Cancel/Unready Functionality', () => {
        it('should send cancel with correct user_id from JWT token', async () => {
            const location = {
                state: {
                    opponent: { id: 5, username: 'maria' },
                    currentUser: { id: 4, username: 'joao' },
                },
            }

            renderWithRouter('invite-4-5-123', location.state)

            act(() => {
                wsConnectHandler.onOpen?.()
            })

            // Click cancel
            const cancelButton = screen.getByText('Cancel')
            await user.click(cancelButton)

            // Should send cancel_waiting_room with extracted user_id
            expect(mockWs.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'cancel_waiting_room',
                    user_id: 4, // From JWT credential_id
                    username: 'joao',
                })
            )
        })

        it('should handle player_unready message correctly', async () => {
            const location = {
                state: {
                    opponent: { id: 5, username: 'maria' },
                    currentUser: { id: 4, username: 'joao' },
                },
            }

            renderWithRouter('invite-4-5-123', location.state)

            act(() => {
                wsConnectHandler.onOpen?.()
            })

            // Mark both as ready
            act(() => {
                wsConnectHandler.onMessage?.({ type: 'player_ready', user_id: 4 })
            })

            act(() => {
                wsConnectHandler.onMessage?.({ type: 'player_ready', user_id: 5 })
            })

            await waitFor(() => {
                expect(screen.getByText(/Both players are ready/)).toBeInTheDocument()
            })

            // Opponent becomes unready
            act(() => {
                wsConnectHandler.onMessage?.({
                    type: 'player_unready',
                    user_id: 5,
                    username: 'maria',
                })
            })

            // Should go back to waiting for ready
            await waitFor(() => {
                const playerCards = screen.getAllByText(/Player (one|two)/i).map(el => el.closest('article'))
                const mariaCard = playerCards.find(card => card?.textContent.includes('maria'))
                expect(mariaCard?.textContent).toMatch(/Waiting for ready/)
            })
        })

        it('should redirect to tournament page on ready timeout WO', async () => {
            const location = {
                state: {
                    opponent: { id: 5, username: 'maria' },
                    currentUser: { id: 4, username: 'joao' },
                    tournamentId: 77,
                },
            }

            renderWithRouter('invite-4-5-123', location.state)

            act(() => {
                wsConnectHandler.onOpen?.()
            })

            act(() => {
                wsConnectHandler.onMessage?.({
                    type: 'ready_timeout',
                    winner_id: 4,
                    tournament_id: 77,
                })
            })

            await waitFor(() => {
                expect(screen.getByText('Tournament page')).toBeInTheDocument()
            })
        })

        it('should redirect to play page on ready timeout without tournament context', async () => {
            const location = {
                state: {
                    opponent: { id: 5, username: 'maria' },
                    currentUser: { id: 4, username: 'joao' },
                },
            }

            renderWithRouter('invite-4-5-123', location.state)

            act(() => {
                wsConnectHandler.onOpen?.()
            })

            act(() => {
                wsConnectHandler.onMessage?.({
                    type: 'ready_timeout',
                    winner_id: null,
                })
            })

            await waitFor(() => {
                expect(screen.getByText('Play page')).toBeInTheDocument()
            })
        })
    })

    describe('ID Mismatch Detection', () => {
        it('should log debug info when ID does not match any player', async () => {
            const consoleSpy = vi.spyOn(console, 'debug')

            const location = {
                state: {
                    opponent: { id: 5, username: 'maria' },
                    currentUser: { id: 4, username: 'joao' },
                },
            }

            renderWithRouter('invite-4-5-123', location.state)

            act(() => {
                wsConnectHandler.onOpen?.()
            })

            // Message from unknown user
            act(() => {
                wsConnectHandler.onMessage?.({
                    type: 'player_ready',
                    user_id: 999, // Unknown ID
                    username: 'unknown',
                })
            })

            // Should log ID mismatch
            expect(consoleSpy).toHaveBeenCalledWith(
                '[GameWaitingRoom] player_ready ID mismatch:',
                expect.objectContaining({
                    incomingUserId: '999',
                    currentUserId: '4',
                    opponentUserId: '5',
                    isCurrentUser: false,
                    isOpponent: false,
                })
            )

            consoleSpy.mockRestore()
        })
    })
})

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
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

describe('GameWaitingRoom - Ready Message Sync', () => {
    let mockWs
    let wsConnectHandler

    beforeEach(() => {
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

    describe('JWT Token User ID Extraction', () => {
        it('should extract credential_id from JWT token for handleReady', async () => {
            const location = { state: { opponent: { id: 5, username: 'maria' } } }

            render(
                <BrowserRouter>
                    <GameWaitingRoom />
                </BrowserRouter>,
                { initialEntries: [{ pathname: '/game/waiting/invite-4-5-123', state: location.state }] }
            )

            // Simulate WebSocket connection
            wsConnectHandler.onOpen?.()

            // Click ready button
            const readyButton = screen.getByText('Get Ready')
            fireEvent.click(readyButton)

            // Verify decodeJWT was called
            expect(decodeJWT).toHaveBeenCalledWith(mockAuthContext.auth.access_token)

            // Verify payload contains extracted credential_id
            expect(mockWs.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'player_ready',
                    user_id: 4, // From credential_id
                    username: 'You',
                })
            )
        })

        it('should not send ready if JWT token extraction fails', async () => {
            decodeJWT.mockReturnValue(null)

            const location = { state: { opponent: { id: 5, username: 'maria' } } }

            render(
                <BrowserRouter>
                    <GameWaitingRoom />
                </BrowserRouter>,
                { initialEntries: [{ pathname: '/game/waiting/invite-4-5-123', state: location.state }] }
            )

            wsConnectHandler.onOpen?.()

            const readyButton = screen.getByText('Get Ready')
            fireEvent.click(readyButton)

            // Should not send message
            expect(mockWs.send).not.toHaveBeenCalled()

            // Should show error message
            await waitFor(() => {
                expect(screen.getByText(/Error: Authentication not ready/)).toBeInTheDocument()
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

            render(
                <BrowserRouter>
                    <GameWaitingRoom />
                </BrowserRouter>,
                { initialEntries: [{ pathname: '/game/waiting/invite-4-5-123', state: location.state }] }
            )

            wsConnectHandler.onOpen?.()

            // Simulate opponent ready message
            wsConnectHandler.onMessage?.({
                type: 'player_ready',
                user_id: 5, // Maria's ID
                username: 'maria',
            })

            // Opponent should be marked as ready
            await waitFor(() => {
                expect(screen.getByText(/waiting for the other player/i)).toBeInTheDocument()
            })
        })

        it('should recognize current player ready message by user_id', async () => {
            const location = {
                state: {
                    opponent: { id: 5, username: 'maria' },
                    currentUser: { id: 4, username: 'joao' },
                },
            }

            render(
                <BrowserRouter>
                    <GameWaitingRoom />
                </BrowserRouter>,
                { initialEntries: [{ pathname: '/game/waiting/invite-4-5-123', state: location.state }] }
            )

            wsConnectHandler.onOpen?.()

            // Simulate current player's ready message (echo from server)
            wsConnectHandler.onMessage?.({
                type: 'player_ready',
                user_id: 4, // João's ID (current)
                username: 'joao',
            })

            // Current should be marked as ready
            await waitFor(() => {
                expect(screen.getByText(/You are ready/)).toBeInTheDocument()
            })
        })

        it('should handle string and number ID types', async () => {
            const location = {
                state: {
                    opponent: { id: '5', username: 'maria' }, // String ID in state
                    currentUser: { id: 4, username: 'joao' },
                },
            }

            render(
                <BrowserRouter>
                    <GameWaitingRoom />
                </BrowserRouter>,
                { initialEntries: [{ pathname: '/game/waiting/invite-4-5-123', state: location.state }] }
            )

            wsConnectHandler.onOpen?.()

            // Message with number ID from server
            wsConnectHandler.onMessage?.({
                type: 'player_ready',
                user_id: 5, // Number from server
                username: 'maria',
            })

            // Should still match correctly (String('5') === String(5))
            await waitFor(() => {
                expect(screen.getByText(/waiting for the other player/i)).toBeInTheDocument()
            })
        })

        it('should fallback to username if ID unavailable', async () => {
            const location = {
                state: {
                    opponent: { id: 'remote-player', username: 'maria' }, // Default fallback ID
                    currentUser: { id: 'local-player', username: 'joao' },
                },
            }

            render(
                <BrowserRouter>
                    <GameWaitingRoom />
                </BrowserRouter>,
                { initialEntries: [{ pathname: '/game/waiting/invite-4-5-123', state: location.state }] }
            )

            wsConnectHandler.onOpen?.()

            // Message with no user_id
            wsConnectHandler.onMessage?.({
                type: 'player_ready',
                username: 'maria', // Only username available
            })

            // Should match by username
            await waitFor(() => {
                expect(screen.getByText(/waiting for the other player/i)).toBeInTheDocument()
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

            render(
                <BrowserRouter>
                    <GameWaitingRoom />
                </BrowserRouter>,
                { initialEntries: [{ pathname: '/game/waiting/invite-4-5-123', state: location.state }] }
            )

            wsConnectHandler.onOpen?.()

            // Step 1: João sends ready
            const readyButton = screen.getByText('Get Ready')
            fireEvent.click(readyButton)

            expect(mockWs.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'player_ready',
                    user_id: 4,
                })
            )

            // Step 2: Server echoes João's ready
            wsConnectHandler.onMessage?.({
                type: 'player_ready',
                user_id: 4,
                username: 'joao',
            })

            expect(screen.getByText(/You are ready/)).toBeInTheDocument()

            // Step 3: Maria sends ready
            wsConnectHandler.onMessage?.({
                type: 'player_ready',
                user_id: 5,
                username: 'maria',
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

            render(
                <BrowserRouter>
                    <GameWaitingRoom />
                </BrowserRouter>,
                { initialEntries: [{ pathname: '/game/waiting/invite-4-5-123', state: location.state }] }
            )

            wsConnectHandler.onOpen?.()

            // Click cancel
            const cancelButton = screen.getByText('Cancel')
            fireEvent.click(cancelButton)

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

            render(
                <BrowserRouter>
                    <GameWaitingRoom />
                </BrowserRouter>,
                { initialEntries: [{ pathname: '/game/waiting/invite-4-5-123', state: location.state }] }
            )

            wsConnectHandler.onOpen?.()

            // Mark both as ready
            wsConnectHandler.onMessage?.({ type: 'player_ready', user_id: 4 })
            wsConnectHandler.onMessage?.({ type: 'player_ready', user_id: 5 })

            expect(screen.getByText(/Both players are ready/)).toBeInTheDocument()

            // Opponent becomes unready
            wsConnectHandler.onMessage?.({
                type: 'player_unready',
                user_id: 5,
                username: 'maria',
            })

            // Should go back to waiting for ready
            await waitFor(() => {
                expect(screen.getByText(/Waiting for both players/)).toBeInTheDocument()
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

            render(
                <BrowserRouter>
                    <GameWaitingRoom />
                </BrowserRouter>,
                { initialEntries: [{ pathname: '/game/waiting/invite-4-5-123', state: location.state }] }
            )

            wsConnectHandler.onOpen?.()

            // Message from unknown user
            wsConnectHandler.onMessage?.({
                type: 'player_ready',
                user_id: 999, // Unknown ID
                username: 'unknown',
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

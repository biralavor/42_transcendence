import NavbarComponent from './Navbar'
import './AuthRequired.css'

export default function AuthLoading() {
    return (
        <>
            <NavbarComponent />

            <main className="auth-required-page">
                <section
                    className="auth-required-card"
                    aria-busy="true"
                    aria-live="polite"
                >
                    <h1>Loading</h1>
                    <p>Checking authentication status...</p>
                </section>
            </main>
        </>
    )
}

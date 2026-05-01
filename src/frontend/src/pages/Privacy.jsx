import NavbarComponent from '../Components/Navbar'
import { Link } from 'react-router-dom'

export default function Privacy() {
  return (
    <div className="arcade-shell">
      <NavbarComponent />

      <main className="arcade-content py-4">
        <section className="arcade-screen mb-4">
          <div className="arcade-panel p-4 p-lg-5">
            <h1 className="arcade-title mb-3 text-center">Privacy Policy</h1>
            <p className="arcade-copy text-center mb-0">
              Last updated: 2026-05-01
            </p>
          </div>
        </section>

        <section className="arcade-screen mb-4">
          <div className="arcade-panel p-4 p-lg-5">
            <h2 className="arcade-card-title mb-3">1. Who we are</h2>
            <p className="arcade-copy">
              ft_transcendence is an academic project built by 42 Cursus students.
              It is not a commercial service. The platform is operated locally by
              the team for educational and evaluation purposes.
            </p>

            <h2 className="arcade-card-title mt-4 mb-3">2. What we collect</h2>
            <ul className="arcade-list">
              <li>Account: username, hashed password (bcrypt), and an optional
                avatar image you upload.</li>
              <li>Profile: optional display name and bio you provide.</li>
              <li>Gameplay: match history (opponents, scores, dates) and
                tournament participation.</li>
              <li>Chat: messages you send in chat rooms and direct messages,
                stored to render conversation history.</li>
              <li>Activity: timestamps of logins and per-day counts of games
                played and messages sent, used to power your activity dashboard.</li>
              <li>Session: short-lived JSON Web Tokens stored in your browser
                to keep you signed in.</li>
            </ul>

            <h2 className="arcade-card-title mt-4 mb-3">3. What we do NOT collect</h2>
            <ul className="arcade-list">
              <li>We do not collect email addresses, phone numbers, payment
                information, real names, IP geolocation, or any third-party
                tracking identifiers.</li>
              <li>We do not use advertising cookies or analytics trackers.</li>
            </ul>

            <h2 className="arcade-card-title mt-4 mb-3">4. How we use your data</h2>
            <p className="arcade-copy">
              Your data is used solely to operate the platform: authenticate
              you, render your profile, deliver real-time messages and game
              events, and compute the statistics shown on your dashboard.
            </p>

            <h2 className="arcade-card-title mt-4 mb-3">5. Sharing</h2>
            <p className="arcade-copy">
              We do not sell, rent, or share your data with third parties.
              Other registered users on the same instance can see your
              public profile (username, avatar, display name, match history,
              and any messages you send in shared rooms).
            </p>

            <h2 className="arcade-card-title mt-4 mb-3">6. Storage and security</h2>
            <p className="arcade-copy">
              Data is stored in a PostgreSQL database hosted alongside the
              application. Passwords are hashed with bcrypt and never stored
              in plaintext. All traffic between your browser and the server
              is encrypted with TLS.
            </p>

            <h2 className="arcade-card-title mt-4 mb-3">7. Your rights</h2>
            <p className="arcade-copy">
              You can request deletion of your account and associated data
              at any time by contacting the team. Because this is an academic
              instance, deletion is performed manually on request.
            </p>

            <h2 className="arcade-card-title mt-4 mb-3">8. Contact</h2>
            <p className="arcade-copy">
              For privacy questions, open an issue on the project repository
              or contact the team via 42 intra.
            </p>

            <div className="text-center mt-4">
              <Link to="/register" className="arcade-btn arcade-btn-secondary">
                Back to register
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

import NavbarComponent from '../Components/Navbar'
import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="arcade-shell">
      <NavbarComponent />

      <main className="arcade-content py-4">
        <section className="arcade-screen mb-4">
          <div className="arcade-panel p-4 p-lg-5">
            <h1 className="arcade-title mb-3 text-center">Terms of Use</h1>
            <p className="arcade-copy text-center mb-0">
              Last updated: 2026-05-01
            </p>
          </div>
        </section>

        <section className="arcade-screen mb-4">
          <div className="arcade-panel p-4 p-lg-5">
            <h2 className="arcade-card-title mb-3">1. About this service</h2>
            <p className="arcade-copy">
              ft_transcendence is an academic project produced by 42 Cursus
              students. It is provided for educational and evaluation
              purposes, free of charge, with no commercial intent and no
              service-level guarantees.
            </p>

            <h2 className="arcade-card-title mt-4 mb-3">2. Eligibility</h2>
            <p className="arcade-copy">
              You may create an account if you are a student, evaluator,
              or guest authorized by the team. You are responsible for
              keeping your credentials secure.
            </p>

            <h2 className="arcade-card-title mt-4 mb-3">3. Acceptable use</h2>
            <p className="arcade-copy">By using the platform you agree to:</p>
            <ul className="arcade-list">
              <li>Not harass, threaten, or send abusive content to other
                users in chat or direct messages.</li>
              <li>Not attempt to cheat, exploit, or interfere with games,
                tournaments, scoring, or other users' sessions.</li>
              <li>Not upload illegal, copyrighted, or harmful content as
                avatars or chat messages.</li>
              <li>Not attempt to gain unauthorized access to other users'
                accounts, the database, or the underlying infrastructure.</li>
              <li>Not run automated scripts, bots, or load tests against
                the service without prior coordination with the team.</li>
            </ul>

            <h2 className="arcade-card-title mt-4 mb-3">4. Content you provide</h2>
            <p className="arcade-copy">
              You retain ownership of the username, avatar, display name,
              bio, and chat messages you submit. By submitting them you
              grant the team a non-exclusive license to store and display
              them within the platform for as long as your account exists.
            </p>

            <h2 className="arcade-card-title mt-4 mb-3">5. Account termination</h2>
            <p className="arcade-copy">
              The team may suspend or remove accounts that violate these
              terms, particularly in cases of harassment, cheating, or
              attempts to compromise the platform. You may request deletion
              of your account at any time.
            </p>

            <h2 className="arcade-card-title mt-4 mb-3">6. No warranty</h2>
            <p className="arcade-copy">
              The platform is provided "as is" without warranty of any
              kind. The team is not liable for downtime, lost matches,
              lost messages, or any indirect damages arising from use of
              the service.
            </p>

            <h2 className="arcade-card-title mt-4 mb-3">7. Privacy</h2>
            <p className="arcade-copy">
              How we handle your data is described in our{' '}
              <Link to="/privacy">Privacy Policy</Link>.
            </p>

            <h2 className="arcade-card-title mt-4 mb-3">8. Changes</h2>
            <p className="arcade-copy">
              These terms may be updated as the project evolves. Continued
              use after a change constitutes acceptance of the updated
              terms.
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

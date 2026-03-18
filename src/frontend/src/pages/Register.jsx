import NavbarComponent from '../Components/Navbar'
import RegisterForm from '../Components/RegisterForm'

export default function Register() {
    return (
        <div className="arcade-shell">
            <NavbarComponent />

            <main className="arcade-auth-layout">
                <RegisterForm />
            </main>
        </div>
    )
}
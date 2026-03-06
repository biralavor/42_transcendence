import { Link } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import RegisterForm from '../Components/RegisterForm'

export default function Register ()
{
    return(
    <main>
        <NavbarComponent></NavbarComponent>
        <RegisterForm></RegisterForm>
    </main>
    
    )
}
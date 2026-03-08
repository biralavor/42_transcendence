import { Link } from 'react-router-dom'
import NavbarComponent from '../Components/Navbar'
import PongCanvas from '../Components/PongCanvas'

export default function Play ()
{
    return(
    <main>
        <NavbarComponent></NavbarComponent>
        <h3>hello world from play</h3>
	<PongCanvas/>
    </main>
    )
}

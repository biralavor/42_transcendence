import { Link } from 'react-router-dom'
import './Home.css'
import NavbarComponent from '../Components/Navbar'

export default function Home() {
  return (
    <body>
      <NavbarComponent></NavbarComponent>
      <h3>hello world from home</h3>
    </body>
  )
}
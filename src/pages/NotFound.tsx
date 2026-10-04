import { Link } from 'react-router-dom'
import { Button, Logo } from '../components/ui'

export function NotFound() {
  return (
    <div className="mesh grid min-h-screen place-items-center px-4 text-center">
      <div>
        <Logo />
        <p className="stat-num mt-8 text-7xl text-lime">404</p>
        <h1 className="font-display mt-2 text-3xl">That class isn’t on the board.</h1>
        <Link to="/"><Button className="mt-6">Back to the club</Button></Link>
      </div>
    </div>
  )
}

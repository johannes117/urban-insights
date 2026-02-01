import { Link } from '@tanstack/react-router'

import './Header.css'

export default function Header() {
  return (
    <header className="header">
      <nav className="nav">
        <div className="nav-item">
          <Link to="/">Home</Link>
        </div>

        <div className="px-2 font-bold">
          <Link to="/admin">Admin</Link>
        </div>
      </nav>
    </header>
  )
}

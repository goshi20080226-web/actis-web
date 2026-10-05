import UserMenu from "./usermenu.jsx"

const APP_VERSION = "0.1.0"

function Header() {
  return (
    <header className="header">
      <div className="header-title">
        <h1>ACTIS</h1>
        <span>Railway Timetable System</span>
        <span className="app-version">v{APP_VERSION}</span>
      </div>
      <UserMenu />
    </header>
  )
}

export default Header

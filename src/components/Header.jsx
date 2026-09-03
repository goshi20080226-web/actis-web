import UserMenu from "./usermenu.jsx"


function Header() {

  return (

    <header className="header">

      <div className="header-title">

        <h1>
          ACTIS
        </h1>

        <span>
          Railway Timetable System
        </span>

      </div>


      <UserMenu />

    </header>

  )

}


export default Header

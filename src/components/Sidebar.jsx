import { Link } from "react-router-dom"

function Sidebar() {
  return (
    <aside className="sidebar">

      <Link to="/">
        ホーム
      </Link>

      <Link to="/timetable">
        時刻表
      </Link>

      <Link to="/diagram">
        ダイヤグラム
      </Link>

      <Link to="/lines">
        路線一覧
      </Link>
      <Link to="/trains">
        列車一覧
      </Link>
      <Link to="/admin">
        管理画面
      </Link>
      <Link to="/staff">
        スタフ
        </Link>
      <Link to="/upload">
       データアップロード
      </Link>
    </aside>
  )
}

export default Sidebar
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "../firebase/config"
import { isAdminUser } from "../utils/admin"

function Sidebar() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    return onAuthStateChanged(auth, user => {
      setIsAdmin(isAdminUser(user))
    })
  }, [])

  return (
    <aside className="sidebar">
      <Link to="/">ホーム</Link>
      <Link to="/timetable">時刻表</Link>
      <Link to="/board">駅発車標</Link>
      {isAdmin && <Link to="/diagram">ダイヤグラム（開発中）</Link>}
      <Link to="/lines">路線一覧</Link>
      <Link to="/trains">列車一覧</Link>
      {isAdmin && <Link to="/admin">管理画面</Link>}
      {isAdmin && <Link to="/staff">スタフ（開発中）</Link>}
      {isAdmin && <Link to="/roster">行路組み立て（開発中）</Link>}
      <Link to="/upload">データアップロード</Link>

      <div className="sidebar-footer">
        <Link to="/privacy">プライバシーポリシー</Link>
        <Link to="/terms">利用規約</Link>
        <span>© 2026 ACTIS / goshi4058</span>
      </div>
    </aside>
  )
}

export default Sidebar

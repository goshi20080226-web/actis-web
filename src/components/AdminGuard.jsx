import { useEffect, useState } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { Navigate } from "react-router-dom"
import { auth } from "../firebase/config"
import { isAdminUser } from "../utils/admin"

function AdminGuard({ children }) {
  const [state, setState] = useState("checking")

  useEffect(() => {
    return onAuthStateChanged(auth, user => {
      setState(user && isAdminUser(user) ? "allowed" : "denied")
    })
  }, [])

  if (state === "checking") {
    return <div>管理者権限を確認しています...</div>
  }

  if (state === "denied") {
    return <Navigate to="/" replace />
  }

  return children
}

export default AdminGuard

import { useEffect, useState } from "react"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { get, ref } from "firebase/database"
import { Navigate } from "react-router-dom"
import { auth, database } from "../firebase/config"

function AuthGuard({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [banned, setBanned] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async currentUser => {
      if (!currentUser) {
        setUser(null)
        setBanned(false)
        setLoading(false)
        return
      }

      try {
        const snapshot = await get(ref(database, `users/${currentUser.uid}/profile`))
        const profile = snapshot.exists() ? snapshot.val() : {}
        if (profile.banned === true) {
          setBanned(true)
          setUser(null)
          await signOut(auth)
        } else {
          setUser(currentUser)
          setBanned(false)
        }
      } catch (err) {
        console.error("AuthGuard profile check error:", err)
        setUser(currentUser)
        setBanned(false)
      } finally {
        setLoading(false)
      }
    })

    return unsubscribe
  }, [])

  if (loading) return <div>認証確認中...</div>
  if (banned) {
    return (
      <div className="auth-banned">
        <strong>このアカウントはBANされています。</strong>
        <p>ACTISを利用することはできません。</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default AuthGuard

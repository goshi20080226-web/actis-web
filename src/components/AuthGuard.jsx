import {
  useEffect,
  useState
} from "react"

import {
  onAuthStateChanged
} from "firebase/auth"

import {
  Navigate
} from "react-router-dom"

import {
  auth
} from "../firebase/config"


function AuthGuard({
  children
}) {

  const [user, setUser] =
    useState(null)

  const [loading, setLoading] =
    useState(true)


  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(
        auth,
        currentUser => {

          setUser(
            currentUser
          )

          setLoading(false)

        }
      )


    return unsubscribe

  }, [])


  if (loading) {

    return (

      <div>
        認証確認中...
      </div>

    )

  }


  if (!user) {

    return (
      <Navigate
        to="/login"
        replace
      />
    )

  }


  return children

}


export default AuthGuard
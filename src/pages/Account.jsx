import {
  useEffect,
  useState
} from "react"

import {
  signOut
} from "firebase/auth"

import {
  ref,
  get,
  update
} from "firebase/database"

import {
  useNavigate
} from "react-router-dom"

import {
  auth,
  database
} from "../firebase/config"


function Account() {

  const navigate =
    useNavigate()


  const [
    user,
    setUser
  ] =
    useState(null)


  const [
    profile,
    setProfile
  ] =
    useState(null)


  const [
    displayName,
    setDisplayName
  ] =
    useState("")


  const [
    loading,
    setLoading
  ] =
    useState(true)


  const [
    saving,
    setSaving
  ] =
    useState(false)


  const [
    message,
    setMessage
  ] =
    useState("")


  const [
    error,
    setError
  ] =
    useState("")


  useEffect(() => {

    const loadAccount =
      async () => {

        try {

          const currentUser =
            auth.currentUser


          if (!currentUser) {

            navigate(
              "/login",
              {
                replace: true
              }
            )

            return

          }


          setUser(
            currentUser
          )


          const snapshot =
            await get(
              ref(
                database,
                `users/${currentUser.uid}/profile`
              )
            )


          const data =
            snapshot.exists()
              ? snapshot.val()
              : {}


          setProfile(
            data
          )


          setDisplayName(
            data.displayName ||
            data.discord?.globalName ||
            data.discord?.username ||
            data.google?.name ||
            ""
          )

        }

        catch (err) {

          console.error(
            "Account load error:",
            err
          )


          setError(
            "アカウント情報を取得できませんでした。"
          )

        }

        finally {

          setLoading(
            false
          )

        }

      }


    loadAccount()

  }, [navigate])


  const saveProfile =
    async () => {

      if (!user) {
        return
      }


      const name =
        String(
          displayName || ""
        ).trim()


      if (!name) {

        setError(
          "表示名を入力してください。"
        )

        return

      }


      try {

        setSaving(
          true
        )

        setMessage("")
        setError("")


        await update(

          ref(
            database,
            `users/${user.uid}/profile`
          ),

          {

            displayName:
              name,

            updatedAt:
              Date.now()

          }

        )


        setProfile(
          current => ({
            ...current,
            displayName:
              name,
            updatedAt:
              Date.now()
          })
        )


        setMessage(
          "アカウント情報を保存しました。"
        )

      }

      catch (err) {

        console.error(
          "Account save error:",
          err
        )


        setError(
          `保存に失敗しました: ${err.message}`
        )

      }

      finally {

        setSaving(
          false
        )

      }

    }


  const logout =
    async () => {

      try {

        await signOut(
          auth
        )


        navigate(
          "/login",
          {
            replace: true
          }
        )

      }

      catch (err) {

        console.error(
          "Logout error:",
          err
        )


        setError(
          `ログアウトに失敗しました: ${err.message}`
        )

      }

    }


  if (loading) {

    return (

      <div>

        <h1>
          アカウント設定
        </h1>

        <p>
          読み込み中...
        </p>

      </div>

    )

  }


  if (!user) {
    return null
  }


  const providers =
    Array.isArray(
      profile?.providers
    )
      ? profile.providers
      : []


  const discordConnected =
    providers.includes(
      "discord"
    )


  const googleConnected =
    providers.includes(
      "google"
    )


  return (

    <div
      className="account-page"
    >

      <div
        className="account-header"
      >

        <div>

          <h1>
            アカウント設定
          </h1>

          <p>
            ACTISアカウントを管理します。
          </p>

        </div>


        <button
          type="button"
          onClick={() =>
            navigate("/")
          }
        >
          戻る
        </button>

      </div>


      <div
        className="account-card"
      >

        <h2>
          ACTISアカウント
        </h2>


        <div
          className="account-row"
        >

          <div
            className="account-label"
          >
            ACTISアカウントID
          </div>


          <div
            className="account-value"
          >
            {user.uid}
          </div>

        </div>


        <div
          className="account-row"
        >

          <div
            className="account-label"
          >
            表示名
          </div>


          <div
            className="account-value account-edit"
          >

            <input
              type="text"
              value={
                displayName
              }
              onChange={
                event =>
                  setDisplayName(
                    event.target.value
                  )
              }
              maxLength={50}
              disabled={
                saving
              }
            />


            <button
              type="button"
              onClick={
                saveProfile
              }
              disabled={
                saving
              }
            >

              {saving
                ? "保存中..."
                : "保存"}

            </button>

          </div>

        </div>

      </div>


      <div
        className="account-card"
      >

        <h2>
          ログイン方法
        </h2>


        <div
          className="account-provider"
        >

          <div>

            <strong>
              Discord
            </strong>

            <p>
              {profile?.discord?.username ||
                "Discordアカウント"}
            </p>

          </div>


          <span
            className={
              discordConnected
                ? "provider-connected"
                : "provider-disabled"
            }
          >

            {discordConnected
              ? "接続済み"
              : "未接続"}

          </span>

        </div>


        <div
          className="account-provider"
        >

          <div>

            <strong>
              Google
            </strong>

            <p>
              {profile?.google?.email ||
                "Googleアカウント"}
            </p>

          </div>


          <span
            className={
              googleConnected
                ? "provider-connected"
                : "provider-disabled"
            }
          >

            {googleConnected
              ? "接続済み"
              : "未接続"}

          </span>

        </div>

      </div>


      <div
        className="account-card account-danger"
      >

        <h2>
          セッション
        </h2>


        <button
          type="button"
          onClick={
            logout
          }
        >

          ログアウト

        </button>

      </div>


      {message && (

        <p
          className="account-message"
        >
          {message}
        </p>

      )}


      {error && (

        <p
          className="account-error"
        >
          {error}
        </p>

      )}

    </div>

  )

}


export default Account
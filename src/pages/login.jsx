import {
  useEffect,
  useState
} from "react"

import {
  signInWithCustomToken
} from "firebase/auth"

import {
  ref,
  get,
  set
} from "firebase/database"

import {
  useNavigate
} from "react-router-dom"

import {
  auth,
  database
} from "../firebase/config"


const WORKER_URL =
  "https://actis-auth.goshi20080226.workers.dev"


function Login() {

  const navigate =
    useNavigate()


  const [
    loading,
    setLoading
  ] =
    useState(false)


  const [
    error,
    setError
  ] =
    useState("")


  useEffect(() => {

    const handleToken =
      async () => {

        const hash =
          window.location.hash


        if (!hash) {
          return
        }


        const params =
          new URLSearchParams(
            hash.slice(1)
          )


        const token =
          params.get(
            "token"
          )


        const authError =
          params.get(
            "error"
          )


        /*
         * URLから認証情報を削除
         */

        window.history.replaceState(
          null,
          "",
          "/login"
        )


        /*
         * 認証エラー
         */

        if (authError) {

          setError(
            decodeURIComponent(
              authError
            )
          )

          return

        }


        /*
         * Tokenがなければ終了
         */

        if (!token) {
          return
        }


        /*
         * =====================================
         * 認証情報
         * =====================================
         */

        const provider =
          params.get(
            "provider"
          ) ||
          "unknown"


        const discordId =
          params.get(
            "discord_id"
          ) ||
          ""


        const googleId =
          params.get(
            "google_id"
          ) ||
          ""


        const username =
          params.get(
            "username"
          ) ||
          ""


        const globalName =
          params.get(
            "global_name"
          ) ||
          ""


        const avatar =
          params.get(
            "avatar"
          ) ||
          ""


        const accountEmail =
          params.get(
            "email"
          ) ||
          ""


        try {

          setLoading(
            true
          )

          setError("")


          /*
           * =====================================
           * Firebaseログイン
           * =====================================
           */

          const result =
            await signInWithCustomToken(
              auth,
              token
            )


          const user =
            result.user


          /*
           * =====================================
           * プロフィール参照
           * =====================================
           */

          const profileRef =
            ref(
              database,
              `users/${user.uid}/profile`
            )


          const snapshot =
            await get(
              profileRef
            )


          const oldProfile =
            snapshot.exists()
              ? snapshot.val()
              : {}


          /*
           * =====================================
           * ログイン方法
           * =====================================
           */

          const providers =
            Array.isArray(
              oldProfile.providers
            )
              ? [
                  ...oldProfile.providers
                ]
              : []


          if (
            provider !== "unknown" &&
            !providers.includes(
              provider
            )
          ) {

            providers.push(
              provider
            )

          }


          /*
           * =====================================
           * 基本プロフィール
           * =====================================
           */

          const profile = {

            ...oldProfile,

            actisAccountId:
              user.uid,

            providers,

            updatedAt:
              Date.now()

          }


          /*
           * =====================================
           * Discord
           * =====================================
           */

          if (
            provider === "discord"
          ) {

            profile.discord = {

              id:
                discordId,

              username,

              globalName,

              avatar,

              email:
                accountEmail

            }

          }


          /*
           * =====================================
           * Google
           * =====================================
           */

          if (
            provider === "google"
          ) {

            profile.google = {

              id:
                googleId,

              name:
                globalName ||
                username,

              avatar,

              email:
                accountEmail

            }

          }


          /*
           * =====================================
           * 共通表示名
           * =====================================
           */

          if (
            !profile.displayName
          ) {

            profile.displayName =
              globalName ||
              username ||
              accountEmail ||
              "ACTISユーザー"

          }


          /*
           * =====================================
           * メインメール
           * =====================================
           */

          if (
            accountEmail
          ) {

            profile.email =
              accountEmail

          }


          /*
           * =====================================
           * Firebase保存
           * =====================================
           */

          await set(
            profileRef,
            profile
          )


          /*
           * =====================================
           * ログイン完了
           * =====================================
           */

          navigate(
            "/",
            {
              replace:
                true
            }
          )

        }

        catch (err) {

          console.error(
            "ACTIS login error:",
            err
          )


          setError(
            `ログインに失敗しました: ${err.message}`
          )


          setLoading(
            false
          )

        }

      }


    handleToken()

  }, [navigate])


  /*
   * ========================================
   * Discordログイン
   * ========================================
   */

  const loginDiscord =
    () => {

      setLoading(
        true
      )

      setError("")


      window.location.href =
        `${WORKER_URL}/auth/discord`

    }


  /*
   * ========================================
   * Googleログイン
   * ========================================
   */

  const loginGoogle =
    () => {

      setLoading(
        true
      )

      setError("")


      window.location.href =
        `${WORKER_URL}/auth/google`

    }


  /*
   * ========================================
   * 画面
   * ========================================
   */

  return (

    <div
      className="login-page"
    >

      <div
        className="login-card"
      >

        <h1>
          ACTIS
        </h1>


        <p>
          ACTISアカウントに
          サインイン
        </p>


        {/* ==============================
            Discord
        ============================== */}

        <button
          type="button"
          onClick={
            loginDiscord
          }
          disabled={
            loading
          }

          className="
            login-provider-button
            discord-login-button
          "
        >

          {loading
            ? "ログイン中..."
            : "Discordでサインイン"}

        </button>


        {/* ==============================
            Google
        ============================== */}

        <button
          type="button"
          onClick={
            loginGoogle
          }
          disabled={
            loading
          }

          className="
            login-provider-button
            google-login-button
          "
        >

          {loading
            ? "ログイン中..."
            : "Googleでサインイン"}

        </button>


        {/* ==============================
            エラー
        ============================== */}

        {error && (

          <p
            className="login-error"
          >

            {error}

          </p>

        )}

      </div>

    </div>

  )

}


export default Login
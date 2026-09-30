import {
  useEffect,
  useState
} from "react"

import {
  signInWithCustomToken,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut
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

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailMode, setEmailMode] = useState("login")
  const [emailMessage, setEmailMessage] = useState("")


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

          if (oldProfile.banned === true) {
            await import("firebase/auth").then(({ signOut }) => signOut(auth))
            setError("このアカウントはBANされています。ACTISを利用できません。")
            setLoading(false)
            return
          }


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



  const handleEmailAuth = async event => {
    event.preventDefault()

    const normalizedEmail = String(email || "").trim()

    if (!normalizedEmail || !password) {
      setError("メールアドレスとパスワードを入力してください。")
      return
    }

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください。")
      return
    }

    try {
      setLoading(true)
      setError("")
      setEmailMessage("")

      if (emailMode === "register") {
        const result = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
        const user = result.user

        await sendEmailVerification(user)

        const profileRef = ref(database, "users/" + user.uid + "/profile")
        await set(profileRef, {
          actisAccountId: user.uid,
          email: normalizedEmail,
          displayName: normalizedEmail.split("@")[0] || "ACTISユーザー",
          providers: ["email"],
          emailVerified: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        })

        await signOut(auth)
        setPassword("")
        setEmailMessage("確認メールを送信しました。メール内のリンクを開いてメールアドレスを確認してから、サインインしてください。")
        return
      }

      const result = await signInWithEmailAndPassword(auth, normalizedEmail, password)
      const user = result.user

      if (!user.emailVerified) {
        await sendEmailVerification(user)
        await signOut(auth)
        setPassword("")
        setError("メールアドレスが確認されていません。確認メールを再送しました。メール内のリンクを開いてから、もう一度サインインしてください。")
        return
      }

      const profileRef = ref(database, "users/" + user.uid + "/profile")
      const snapshot = await get(profileRef)
      const oldProfile = snapshot.exists() ? snapshot.val() : {}
      const providers = Array.isArray(oldProfile.providers) ? [...oldProfile.providers] : []

      if (!providers.includes("email")) {
        providers.push("email")
      }

      await set(profileRef, {
        ...oldProfile,
        actisAccountId: user.uid,
        email: user.email || normalizedEmail,
        providers,
        emailVerified: true,
        updatedAt: Date.now()
      })

      navigate("/", { replace: true })
    } catch (err) {
      console.error("ACTIS email auth error:", err)

      const messages = {
        "auth/email-already-in-use": "このメールアドレスは既に登録されています。サインインしてください。",
        "auth/invalid-credential": "メールアドレスまたはパスワードが正しくありません。",
        "auth/invalid-email": "メールアドレスの形式が正しくありません。",
        "auth/weak-password": "パスワードが弱すぎます。6文字以上で設定してください。"
      }

      setError(messages[err.code] || ("認証に失敗しました: " + err.message))
    } finally {
      setLoading(false)
    }
  }

  const resetEmailPassword = async () => {
    const normalizedEmail = String(email || "").trim()

    if (!normalizedEmail) {
      setError("パスワードをリセットするメールアドレスを入力してください。")
      return
    }

    try {
      setLoading(true)
      setError("")
      await sendPasswordResetEmail(auth, normalizedEmail)
      setEmailMessage("パスワード再設定メールを送信しました。メールをご確認ください。")
    } catch (err) {
      console.error("ACTIS password reset error:", err)
      setError("パスワード再設定に失敗しました: " + err.message)
    } finally {
      setLoading(false)
    }
  }

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

        <div className="login-divider">または</div>

        <form className="login-email-form" onSubmit={handleEmailAuth}>
          <h2>{emailMode === "login" ? "メールアドレスでサインイン" : "メールアドレスで新規登録"}</h2>

          <label>
            <span>メールアドレス</span>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="example@example.com"
              disabled={loading}
            />
          </label>

          <label>
            <span>パスワード</span>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete={emailMode === "login" ? "current-password" : "new-password"}
              placeholder="6文字以上"
              disabled={loading}
            />
          </label>

          <button type="submit" className="login-email-submit" disabled={loading}>
            {loading ? "処理中..." : emailMode === "login" ? "メールアドレスでサインイン" : "メールアドレスで登録"}
          </button>
        </form>

        <div className="login-email-actions">
          <button
            type="button"
            onClick={() => {
              setEmailMode(current => current === "login" ? "register" : "login")
              setError("")
              setEmailMessage("")
            }}
            disabled={loading}
          >
            {emailMode === "login" ? "新規アカウントを作成" : "サインインに戻る"}
          </button>

          {emailMode === "login" && (
            <button type="button" onClick={resetEmailPassword} disabled={loading}>
              パスワードを忘れた場合
            </button>
          )}
        </div>

        {emailMessage && (
          <p className="login-message">{emailMessage}</p>
        )}




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
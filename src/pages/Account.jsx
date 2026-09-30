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

import "./Account.css"

const WORKER_URL = "https://actis-auth.goshi20080226.workers.dev"


function Account() {

  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [displayName, setDisplayName] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [linking, setLinking] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {

    const loadAccount = async () => {

      try {

        const currentUser = auth.currentUser

        if (!currentUser) {
          navigate("/login", { replace: true })
          return
        }

        setUser(currentUser)

        const snapshot = await get(
          ref(
            database,
            `users/${currentUser.uid}/profile`
          )
        )

        const data = snapshot.exists()
          ? snapshot.val()
          : {}

        setProfile(data)

        setDisplayName(
          data.discord?.globalName ||
          data.discord?.username ||
          data.google?.name ||
          data.displayName ||
          ""
        )

        const query = new URLSearchParams(window.location.search)
        const linkStatus = query.get("link")
        const linkedProvider = query.get("provider")

        if (linkStatus === "success" && (linkedProvider === "discord" || linkedProvider === "google")) {
          const nextProviders = Array.isArray(data.providers) ? [...data.providers] : []
          if (!nextProviders.includes(linkedProvider)) nextProviders.push(linkedProvider)

          const nextProfile = {
            ...data,
            providers: nextProviders,
            updatedAt: Date.now()
          }

          if (linkedProvider === "discord") {
            nextProfile.discord = {
              id: query.get("discord_id") || "",
              username: query.get("username") || "",
              globalName: query.get("global_name") || "",
              avatar: query.get("avatar") || "",
              email: query.get("email") || ""
            }
          } else {
            nextProfile.google = {
              id: query.get("google_id") || "",
              name: query.get("global_name") || query.get("username") || "",
              avatar: query.get("avatar") || "",
              email: query.get("email") || ""
            }
          }

          await update(
            ref(database, `users/${currentUser.uid}/profile`),
            nextProfile
          )

          setProfile(nextProfile)
          window.history.replaceState(null, "", "/account")
          setMessage(`${linkedProvider === "discord" ? "Discord" : "Google"}アカウントを連携しました。`)
        } else if (linkStatus === "error") {
          setError(query.get("message") || "アカウント連携に失敗しました。")
          window.history.replaceState(null, "", "/account")
        }

      } catch (err) {

        console.error("Account load error:", err)
        setError("アカウント情報を取得できませんでした。")

      } finally {

        setLoading(false)

      }

    }

    loadAccount()

  }, [navigate])


  const saveProfile = async () => {

    if (!user) return

    const name = String(displayName || "").trim()

    if (!name) {
      setError("表示名を入力してください。")
      return
    }

    try {

      setSaving(true)
      setMessage("")
      setError("")

      const updatedAt = Date.now()

      await update(
        ref(database, `users/${user.uid}/profile`),
        {
          displayName: name,
          updatedAt
        }
      )

      setProfile(current => ({
        ...current,
        displayName: name,
        updatedAt
      }))

      setMessage("アカウント情報を保存しました。")

    } catch (err) {

      console.error("Account save error:", err)
      setError(`保存に失敗しました: ${err.message}`)

    } finally {

      setSaving(false)

    }

  }


  const linkProvider = async provider => {
    if (!user || linking) return

    try {
      setLinking(provider)
      setMessage("")
      setError("")

      const idToken = await user.getIdToken()
      const response = await fetch(
        `${WORKER_URL}/auth/link/${provider}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`
          }
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok || !data.url) {
        throw new Error(data.error || "連携開始に失敗しました。")
      }

      window.location.href = data.url
    } catch (err) {
      console.error("Provider link error:", err)
      setError(`連携に失敗しました: ${err.message}`)
      setLinking("")
    }
  }

  const logout = async () => {

    try {

      await signOut(auth)
      navigate("/login", { replace: true })

    } catch (err) {

      console.error("Logout error:", err)
      setError(`ログアウトに失敗しました: ${err.message}`)

    }

  }


  if (loading) {

    return (
      <div className="account-page">
        <div className="account-loading">
          読み込み中...
        </div>
      </div>
    )

  }

  if (!user) return null

  const providers = Array.isArray(profile?.providers)
    ? profile.providers
    : []

  const providerInfo = {
    google: {
      name: "Google",
      value: profile?.google?.email || "Googleアカウント"
    },
    discord: {
      name: "Discord",
      value:
        profile?.discord?.globalName ||
        profile?.discord?.username ||
        "Discordアカウント"
    }
  }

  return (
    <div className="account-page">

      <header className="account-page-header">
        <div>
          <p className="account-eyebrow">ACCOUNT</p>
          <h1>アカウント設定</h1>
          <p className="account-description">
            ACTISアカウントの基本情報とログイン連携を管理します。
          </p>
        </div>

        <button
          type="button"
          className="account-back-button"
          onClick={() => navigate("/")}
        >
          戻る
        </button>
      </header>


      <main className="account-sections">

        <section className="account-section">
          <div className="account-section-header">
            <div>
              <h2>基本情報</h2>
              <p>ACTISで表示する名前を設定します。</p>
            </div>
          </div>

          <div className="account-form">

            <label className="account-field">
              <span>表示名</span>
              <div className="account-field-row">
                <input
                  type="text"
                  value={displayName}
                  onChange={event => setDisplayName(event.target.value)}
                  maxLength={50}
                  disabled={saving}
                  placeholder="表示名を入力"
                />

                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={saving}
                >
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            </label>

            <div className="account-id">
              <span>ACTISアカウントID</span>
              <code>{user.uid}</code>
            </div>

          </div>
        </section>


        <section className="account-section">
          <div className="account-section-header">
            <div>
              <h2>ログイン連携</h2>
              <p>ACTISアカウントに接続されているサービスを確認できます。</p>
            </div>
          </div>

          <div className="account-provider-list">

            {Object.entries(providerInfo).map(([provider, info]) => {

              const connected =
                providers.includes(provider) ||
                Boolean(profile?.[provider])

              return (
                <div
                  className="account-provider"
                  key={provider}
                >
                  <div className="account-provider-main">
                    <strong>{info.name}</strong>
                    <span>
                      {connected
                        ? info.value
                        : `${info.name}アカウント未連携`}
                    </span>
                  </div>

                  <div className="account-provider-actions">
                    <span
                      className={
                        connected
                          ? "account-provider-status connected"
                          : "account-provider-status"
                      }
                    >
                      {connected ? "連携済み" : "未連携"}
                    </span>

                    {!connected && (
                      <button
                        type="button"
                        className="account-provider-link-button"
                        onClick={() => linkProvider(provider)}
                        disabled={Boolean(linking)}
                      >
                        {linking === provider ? "連携中..." : "連携する"}
                      </button>
                    )}
                  </div>
                </div>
              )

            })}

          </div>
        </section>


        <section className="account-section account-session-section">
          <div className="account-section-header">
            <div>
              <h2>セッション</h2>
              <p>現在のACTISアカウントからログアウトします。</p>
            </div>
          </div>

          <button
            type="button"
            className="account-logout-button"
            onClick={logout}
          >
            ログアウト
          </button>
        </section>


        {(message || error) && (
          <div className={error ? "account-alert error" : "account-alert"}>
            {error || message}
          </div>
        )}

      </main>

    </div>
  )
}

export default Account

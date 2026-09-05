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


const AUTH_WORKER_ORIGIN =
  "https://actis-auth-worker.goshi20080226.workers.dev"


function Account() {

  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [displayName, setDisplayName] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
          data.displayName ||
          data.discord?.globalName ||
          data.discord?.username ||
          data.google?.name ||
          ""
        )

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


  const logout = async () => {

    try {

      await signOut(auth)
      navigate("/login", { replace: true })

    } catch (err) {

      console.error("Logout error:", err)
      setError(`ログアウトに失敗しました: ${err.message}`)

    }

  }


  const startLink = provider => {

    if (!user) return

    setError("")
    setMessage(`${providerLabel(provider)}の連携を開始します。`)

    const params = new URLSearchParams({
      uid: user.uid,
      mode: "link"
    })

    window.location.href =
      `${AUTH_WORKER_ORIGIN}/auth/link/${provider}?${params.toString()}`

  }


  const providerLabel = provider => {

    if (provider === "google") return "Google"
    if (provider === "discord") return "Discord"
    if (provider === "roblox") return "Roblox"
    return provider

  }


  if (loading) {

    return (
      <div>
        <h1>アカウント設定</h1>
        <p>読み込み中...</p>
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
    },
    roblox: {
      name: "Roblox",
      value:
        profile?.roblox?.displayName ||
        profile?.roblox?.username ||
        "Robloxアカウント"
    }
  }

  return (
    <div className="account-page">

      <div className="account-header">
        <div>
          <h1>アカウント設定</h1>
          <p>ACTISアカウントを管理します。</p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/")}
        >
          戻る
        </button>
      </div>

      <div className="account-card">

        <h2>ACTISアカウント</h2>

        <div className="account-row">
          <div className="account-label">
            ACTISアカウントID
          </div>
          <div className="account-value">
            {user.uid}
          </div>
        </div>

        <div className="account-row">
          <div className="account-label">
            表示名
          </div>

          <div className="account-value account-edit">
            <input
              type="text"
              value={displayName}
              onChange={event => setDisplayName(event.target.value)}
              maxLength={50}
              disabled={saving}
            />

            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>

      </div>

      <div className="account-card">

        <h2>アカウント連携</h2>

        <p>
          Google・Discord・Robloxを同じACTISアカウントへ連携できます。
        </p>

        {Object.entries(providerInfo).map(([provider, info]) => {

          const connected = providers.includes(provider)

          return (
            <div
              className="account-provider"
              key={provider}
            >

              <div>
                <strong>{info.name}</strong>
                <p>{connected ? info.value : `${info.name}アカウント未連携`}</p>
              </div>

              <div>
                <span
                  className={
                    connected
                      ? "provider-connected"
                      : "provider-disabled"
                  }
                >
                  {connected ? "連携済み" : "未連携"}
                </span>

                {!connected && (
                  <button
                    type="button"
                    onClick={() => startLink(provider)}
                  >
                    {info.name}を連携
                  </button>
                )}
              </div>

            </div>
          )

        })}

      </div>

      <div className="account-card account-danger">

        <h2>セッション</h2>

        <button
          type="button"
          onClick={logout}
        >
          ログアウト
        </button>

      </div>

      {message && (
        <p className="account-message">{message}</p>
      )}

      {error && (
        <p className="account-error">{error}</p>
      )}

    </div>
  )
}

export default Account

import { useEffect, useState } from "react"
import { get, ref, update } from "firebase/database"
import { useNavigate } from "react-router-dom"
import { onAuthStateChanged } from "firebase/auth"
import { auth, database } from "../firebase/config"
import { isAdminUser } from "../utils/admin"
import "./Admin.css"

function countObject(value) {
  return value && typeof value === "object" ? Object.keys(value).length : 0
}

function datasetName(dataset, id) {
  return dataset?.name || dataset?.files?.[0]?.fileName || id || "名称未設定ダイヤ"
}

function Admin() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [admin, setAdmin] = useState(false)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")

  const load = async () => {
    try {
      setLoading(true)
      setError("")
      const currentUser = auth.currentUser
      if (!currentUser || !isAdminUser(currentUser)) {
        setAdmin(false)
        return
      }
      setAdmin(true)

      const snapshot = await get(ref(database, "users"))
      const value = snapshot.exists() ? snapshot.val() : {}
      const list = Object.entries(value || {}).map(([uid, data]) => {
        const item = data && typeof data === "object" ? data : {}
        return {
          uid,
          profile: item.profile || {},
          datasets: item.datasets || {},
          trains: item.trains || {},
          lines: item.lines || {}
        }
      }).sort((a, b) => {
        const at = Number(a.profile.updatedAt || a.profile.createdAt || 0)
        const bt = Number(b.profile.updatedAt || b.profile.createdAt || 0)
        return bt - at
      })
      setUsers(list)
    } catch (err) {
      console.error("Admin load error:", err)
      setError("管理データを取得できませんでした。Firebaseの管理者用ルールも確認してください。")
    } finally {
      setLoading(false)
      setChecking(false)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (!user || !isAdminUser(user)) {
        setAdmin(false)
        setChecking(false)
        setLoading(false)
        return
      }
      load()
    })
    return unsubscribe
  }, [])

  const deleteDataset = async (user, datasetId) => {
    const dataset = user.datasets[datasetId] || {}
    const name = datasetName(dataset, datasetId)
    if (!window.confirm(`「${name}」をユーザー「${user.profile.displayName || user.uid}」から削除しますか？\n\n関連する列車・路線も削除します。この操作は元に戻せません。`)) return

    try {
      setBusy(`dataset:${user.uid}:${datasetId}`)
      const updates = {}
      updates[`users/${user.uid}/datasets/${datasetId}`] = null
      Object.entries(user.trains || {}).forEach(([id, train]) => {
        if (train?.datasetId === datasetId) updates[`users/${user.uid}/trains/${id}`] = null
      })
      Object.entries(user.lines || {}).forEach(([id, line]) => {
        if (line?.datasetId === datasetId) updates[`users/${user.uid}/lines/${id}`] = null
      })
      await update(ref(database), updates)
      await load()
    } catch (err) {
      console.error("Admin dataset delete error:", err)
      setError(`データセットの削除に失敗しました: ${err.message}`)
    } finally {
      setBusy("")
    }
  }

  const deleteUserData = async user => {
    if (user.uid === auth.currentUser?.uid) {
      setError("現在ログインしている管理者自身のデータは、この画面から削除できません。")
      return
    }
    const name = user.profile.displayName || user.profile.email || user.uid
    if (!window.confirm(`ユーザー「${name}」のACTISデータをすべて削除しますか？\n\nプロフィール、ダイヤ、列車、路線などのデータが削除されます。Firebase Authenticationのアカウント自体は削除されません。\n\nこの操作は元に戻せません。`)) return

    try {
      setBusy(`user:${user.uid}`)
      await update(ref(database), { [`users/${user.uid}`]: null })
      await load()
    } catch (err) {
      console.error("Admin user data delete error:", err)
      setError(`ユーザーデータの削除に失敗しました: ${err.message}`)
    } finally {
      setBusy("")
    }
  }

  if (checking || loading) {
    return <div className="admin-page"><div className="admin-loading">管理者権限を確認しています...</div></div>
  }

  if (!admin) {
    return (
      <div className="admin-page">
        <div className="admin-forbidden">
          <strong>管理者専用ページです。</strong>
          <p>このアカウントには管理権限がありません。</p>
          <button type="button" onClick={() => navigate("/")}>ホームへ戻る</button>
        </div>
      </div>
    )
  }

  const datasetCount = users.reduce((sum, user) => sum + countObject(user.datasets), 0)
  const trainCount = users.reduce((sum, user) => sum + countObject(user.trains), 0)

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">ADMINISTRATION</p>
          <h1>ACTIS管理センター</h1>
          <p>ACTISに登録されているアカウントとデータを遠隔管理します。</p>
        </div>
        <span className="admin-self">管理者モード</span>
      </header>

      {error && <div className="admin-error">{error}</div>}

      <section className="admin-stats">
        <div className="admin-stat"><span>アカウントデータ</span><strong>{users.length}</strong></div>
        <div className="admin-stat"><span>データセット</span><strong>{datasetCount}</strong></div>
        <div className="admin-stat"><span>列車データ</span><strong>{trainCount}</strong></div>
      </section>

      <section className="admin-user-list">
        {users.length === 0 ? (
          <div className="admin-empty">登録されているACTISアカウントデータがありません。</div>
        ) : users.map(user => {
          const displayName = user.profile.displayName || user.profile.discord?.globalName || user.profile.google?.name || user.profile.email || "名称未設定"
          const email = user.profile.email || user.profile.discord?.email || user.profile.google?.email || "メールアドレス未登録"
          const isSelf = user.uid === auth.currentUser?.uid
          return (
            <article className="admin-user-card" key={user.uid}>
              <div className="admin-user-head">
                <div className="admin-user-main">
                  <h2>{displayName}</h2>
                  <p>{email}</p>
                  <p><code>{user.uid}</code></p>
                </div>
                <div className="admin-user-actions">
                  {isSelf && <span className="admin-self">現在の管理者</span>}
                  {!isSelf && (
                    <button type="button" className="admin-danger" disabled={busy !== ""} onClick={() => deleteUserData(user)}>
                      {busy === `user:${user.uid}` ? "削除中..." : "全データ削除"}
                    </button>
                  )}
                </div>
              </div>
              <div className="admin-user-body">
                <div className="admin-meta">
                  <span>データセット: {countObject(user.datasets)}</span>
                  <span>列車: {countObject(user.trains)}</span>
                  <span>路線: {countObject(user.lines)}</span>
                  <span>連携: {Array.isArray(user.profile.providers) ? user.profile.providers.join(" / ") : "—"}</span>
                </div>
                <div className="admin-datasets">
                  {Object.entries(user.datasets).length === 0 ? (
                    <div className="admin-empty">データセットなし</div>
                  ) : Object.entries(user.datasets).map(([id, dataset]) => (
                    <div className="admin-dataset" key={id}>
                      <div className="admin-dataset-info">
                        <strong>{datasetName(dataset, id)}</strong>
                        <span>ID: {id} / 列車 {Object.values(user.trains).filter(train => train?.datasetId === id).length} / 路線 {Object.values(user.lines).filter(line => line?.datasetId === id).length}</span>
                      </div>
                      <button type="button" className="admin-danger" disabled={busy !== ""} onClick={() => deleteDataset(user, id)}>
                        {busy === `dataset:${user.uid}:${id}` ? "削除中..." : "削除"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}

export default Admin

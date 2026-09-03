import { useEffect, useMemo, useState } from "react"
import { get, ref } from "firebase/database"
import { onAuthStateChanged } from "firebase/auth"
import { useNavigate } from "react-router-dom"
import { auth, database } from "../firebase/config"
import DatasetSelector from "../components/dataset/DatasetSelector"
import { useDataset } from "../context/DatasetContext"
import "./StaffRoster.css"

function getCurrentUser() {
  return new Promise(resolve => {
    if (auth.currentUser) {
      resolve(auth.currentUser)
      return
    }
    const unsubscribe = onAuthStateChanged(auth, user => {
      unsubscribe()
      resolve(user)
    })
  })
}

function firstTime(train) {
  const stations = Array.isArray(train?.stations) ? train.stations : []
  const values = stations.flatMap(s => [s?.departure, s?.arrival, s?.single]).filter(Boolean).map(String)
  return values[0] || ""
}

function lastTime(train) {
  const stations = Array.isArray(train?.stations) ? train.stations : []
  const values = stations.flatMap(s => [s?.departure, s?.arrival, s?.single]).filter(Boolean).map(String)
  return values.at(-1) || ""
}

function firstStation(train) {
  return train?.origin || train?.stations?.find(s => s?.name)?.name || "—"
}

function lastStation(train) {
  return train?.destination || train?.finalDest || train?.stations?.slice().reverse().find(s => s?.name)?.name || "—"
}

function StaffRoster() {
  const { selectedDatasetId } = useDataset()
  const navigate = useNavigate()
  const [rosters, setRosters] = useState([])
  const [trains, setTrains] = useState([])
  const [selectedRosterId, setSelectedRosterId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const selectedRoster = useMemo(
    () => rosters.find(roster => roster.id === selectedRosterId) || null,
    [rosters, selectedRosterId]
  )

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError("")

      try {
        const user = await getCurrentUser()
        if (!user) {
          setError("ACTISアカウントにログインしてください。")
          return
        }

        if (!selectedDatasetId) {
          setRosters([])
          setTrains([])
          setSelectedRosterId("")
          return
        }

        const [rosterSnap, trainSnap] = await Promise.all([
          get(ref(database, `users/${user.uid}/datasets/${selectedDatasetId}/crewRosters`)),
          get(ref(database, `users/${user.uid}/trains`))
        ])

        if (cancelled) return

        const rosterValue = rosterSnap.exists() ? rosterSnap.val() : {}
        const rosterList = Object.entries(rosterValue)
          .map(([id, value]) => ({ id, ...(value || {}) }))
          .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ja", { numeric: true }))

        const trainValue = trainSnap.exists() ? trainSnap.val() : {}
        const trainList = Object.entries(trainValue)
          .map(([id, value]) => ({ id, ...(value || {}) }))
          .filter(train => String(train.datasetId || "") === String(selectedDatasetId))

        setRosters(rosterList)
        setTrains(trainList)
        setSelectedRosterId(current =>
          rosterList.some(roster => roster.id === current) ? current : rosterList[0]?.id || ""
        )
      } catch (err) {
        console.error("Staff roster load error:", err)
        if (!cancelled) setError(`行路一覧を取得できませんでした：${err.message}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [selectedDatasetId])

  const rosterItems = Array.isArray(selectedRoster?.items) ? selectedRoster.items : []

  return (
    <div className="staff-roster-page">
      <DatasetSelector />

      <header className="staff-roster-header">
        <div>
          <p className="eyebrow">STAFF</p>
          <h1>スタフ</h1>
          <p>行路を選択して、担当列車のスタフを閲覧します。</p>
        </div>
        <button className="staff-roster-edit" onClick={() => navigate("/roster")}>
          行路組み立てを開く
        </button>
      </header>

      {error && <div className="staff-roster-error">{error}</div>}

      {!selectedDatasetId ? (
        <div className="staff-roster-empty">データセットを選択してください。</div>
      ) : loading ? (
        <div className="staff-roster-empty">読み込み中...</div>
      ) : (
        <div className="staff-roster-layout">
          <aside className="staff-roster-list panel">
            <div className="staff-roster-list-head">
              <strong>行路一覧</strong>
              <span>{rosters.length}件</span>
            </div>

            {rosters.length === 0 ? (
              <div className="staff-roster-empty">行路がありません。<br />「行路組み立て」から作成してください。</div>
            ) : rosters.map(roster => {
              const count = Array.isArray(roster.items)
                ? roster.items.filter(item => item?.type === "train").length
                : 0
              return (
                <button
                  key={roster.id}
                  className={`staff-roster-list-item ${roster.id === selectedRosterId ? "active" : ""}`}
                  onClick={() => setSelectedRosterId(roster.id)}
                >
                  <strong>{roster.name || "名称未設定"}</strong>
                  <span>{count}列車</span>
                </button>
              )
            })}
          </aside>

          <main className="staff-roster-view panel">
            {!selectedRoster ? (
              <div className="staff-roster-empty">左側から行路を選択してください。</div>
            ) : (
              <>
                <div className="staff-roster-view-head">
                  <div>
                    <p className="eyebrow">ROSTER</p>
                    <h2>{selectedRoster.name || "名称未設定"}</h2>
                    <span>{selectedRoster.crewType || "乗務員"}</span>
                  </div>
                </div>

                <div className="staff-roster-trains">
                  {rosterItems.length === 0 ? (
                    <div className="staff-roster-empty">この行路には列車がありません。</div>
                  ) : rosterItems.map((item, index) => {
                    if (item?.type !== "train") {
                      const labels = { change: "乗務員交代", break: "休憩", wait: "待機", report: "出勤", finish: "退勤" }
                      return (
                        <div className="staff-roster-event" key={`event-${index}`}>
                          <span className="staff-roster-event-time">{item?.time || "—"}</span>
                          <div>
                            <strong>{labels[item?.type] || "イベント"}</strong>
                            <span>{item?.station || "場所未設定"}</span>
                          </div>
                        </div>
                      )
                    }

                    const train = trains.find(value => String(value.id) === String(item.trainId))
                    if (!train) {
                      return (
                        <div className="staff-roster-missing" key={`${item.trainId}-${index}`}>
                          列車 {item.trainNo || "—"} は現在のデータセットに存在しません。
                        </div>
                      )
                    }

                    return (
                      <button
                        className="staff-roster-train"
                        key={`${item.trainId}-${index}`}
                        onClick={() => navigate(`/staff/${encodeURIComponent(train.id)}?dataset=${encodeURIComponent(selectedDatasetId)}`)}
                      >
                        <div className="staff-roster-order">{index + 1}</div>
                        <div className="staff-roster-train-time">
                          <strong>{firstTime(train) || "—"}</strong>
                          <span>{lastTime(train) || ""}</span>
                        </div>
                        <div className="staff-roster-train-main">
                          <div className="staff-roster-train-title">
                            <strong>{train.trainNo || item.trainNo || "—"}</strong>
                            <span>{train.typeShort || train.type || "—"}</span>
                          </div>
                          <div>{firstStation(train)} → {lastStation(train)}</div>
                        </div>
                        <span className="staff-roster-arrow">›</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </main>
        </div>
      )}
    </div>
  )
}

export default StaffRoster

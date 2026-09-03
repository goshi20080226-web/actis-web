import { useEffect, useMemo, useState } from "react"
import { get, push, ref, remove, set, update } from "firebase/database"
import { onAuthStateChanged } from "firebase/auth"
import { auth, database } from "../firebase/config"
import DatasetSelector from "../components/dataset/DatasetSelector"
import { useDataset } from "../context/DatasetContext"
import "./Roster.css"

function waitForUser() {
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

function getStationTime(station, prefer = "") {
  if (!station) return ""

  const candidates = prefer === "departure"
    ? [station?.departure, station?.single, station?.arrival]
    : prefer === "arrival"
      ? [station?.arrival, station?.single, station?.departure]
      : [station?.departure, station?.arrival, station?.single]

  return candidates.find(value => String(value || "").trim()) || ""
}

function findTrainStation(train, stationName) {
  const name = String(stationName || "").trim()
  if (!name) return null

  const stations = Array.isArray(train?.stations) ? train.stations : []
  return stations.find(station => String(station?.name || "").trim() === name) || null
}

function trainTime(train, rosterItem = null) {
  const beforeStation = findTrainStation(train, rosterItem?.beforeChangeStation)
  if (beforeStation) {
    return getStationTime(beforeStation, "departure")
  }

  const stations = Array.isArray(train?.stations) ? train.stations : []
  const values = stations.flatMap(station => [
    station?.departure,
    station?.arrival,
    station?.single
  ]).filter(Boolean).map(String)

  return values[0] || ""
}

function trainEndTime(train, rosterItem = null) {
  const afterStation = findTrainStation(train, rosterItem?.afterChangeStation)
  if (afterStation) {
    return getStationTime(afterStation, "arrival")
  }

  const beforeStation = findTrainStation(train, rosterItem?.beforeChangeStation)
  if (beforeStation) {
    return getStationTime(beforeStation, "departure")
  }

  const stations = Array.isArray(train?.stations) ? train.stations : []
  const values = stations.flatMap(station => [
    station?.departure,
    station?.arrival,
    station?.single
  ]).filter(Boolean).map(String)

  return values.at(-1) || ""
}

function firstStation(train) {
  return train?.origin ||
    train?.stations?.find(station => station?.name)?.name ||
    "—"
}

function lastStation(train) {
  return train?.destination ||
    train?.finalDest ||
    train?.stations?.slice().reverse().find(station => station?.name)?.name ||
    "—"
}

function Roster() {
  const { selectedDatasetId } = useDataset()
  const [rosters, setRosters] = useState([])
  const [trains, setTrains] = useState([])
  const [selectedRosterId, setSelectedRosterId] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [showTrainPicker, setShowTrainPicker] = useState(false)
  const [trainSearch, setTrainSearch] = useState("")
  const [eventType, setEventType] = useState("break")
  const [eventStation, setEventStation] = useState("")
  const [eventTime, setEventTime] = useState("")

  const selectedRoster = useMemo(
    () => rosters.find(roster => roster.id === selectedRosterId) || null,
    [rosters, selectedRosterId]
  )

  const loadData = async () => {
    const user = await waitForUser()
    if (!user) {
      setError("ACTISアカウントにログインしてください。")
      setLoading(false)
      return
    }

    if (!selectedDatasetId) {
      setRosters([])
      setTrains([])
      setSelectedRosterId("")
      setLoading(false)
      return
    }

    setLoading(true)
    setError("")

    try {
      const [rosterSnap, trainSnap] = await Promise.all([
        get(ref(database, `users/${user.uid}/datasets/${selectedDatasetId}/crewRosters`)),
        get(ref(database, `users/${user.uid}/trains`)),
      ])

      const rosterValue = rosterSnap.exists() ? rosterSnap.val() : {}
      const rosterList = Object.entries(rosterValue)
        .map(([id, value]) => ({ id, ...(value || {}) }))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ja"))

      const trainValue = trainSnap.exists() ? trainSnap.val() : {}
      const trainList = Object.entries(trainValue)
        .map(([id, value]) => ({ id, ...(value || {}) }))
        .filter(train => String(train.datasetId || "") === String(selectedDatasetId))
        .sort((a, b) => {
          const at = String(trainTime(a) || "")
          const bt = String(trainTime(b) || "")
          return at.localeCompare(bt, undefined, { numeric: true })
        })

      setRosters(rosterList)
      setTrains(trainList)
      setSelectedRosterId(current =>
        rosterList.some(roster => roster.id === current)
          ? current
          : rosterList[0]?.id || ""
      )
    } catch (err) {
      console.error("Roster load error:", err)
      setError(`行路データを取得できませんでした：${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedDatasetId])

  const createRoster = async () => {
    const user = await waitForUser()
    if (!user || !selectedDatasetId) return

    const name = window.prompt("行路名を入力してください", `${rosters.length + 1}行路`)
    if (!name?.trim()) return

    setSaving(true)
    try {
      const rosterRef = push(
        ref(database, `users/${user.uid}/datasets/${selectedDatasetId}/crewRosters`)
      )
      await set(rosterRef, {
        name: name.trim(),
        crewType: "乗務員",
        items: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      await loadData()
      setSelectedRosterId(rosterRef.key)
    } catch (err) {
      setError(`行路を作成できませんでした：${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const renameRoster = async () => {
    if (!selectedRoster) return
    const name = window.prompt("行路名を変更", selectedRoster.name || "")
    if (!name?.trim()) return

    const user = await waitForUser()
    if (!user) return

    await update(
      ref(database, `users/${user.uid}/datasets/${selectedDatasetId}/crewRosters/${selectedRoster.id}`),
      { name: name.trim(), updatedAt: Date.now() }
    )
    await loadData()
  }

  const deleteRoster = async () => {
    if (!selectedRoster) return
    if (!window.confirm(`「${selectedRoster.name}」を削除しますか？`)) return

    const user = await waitForUser()
    if (!user) return

    await remove(
      ref(database, `users/${user.uid}/datasets/${selectedDatasetId}/crewRosters/${selectedRoster.id}`)
    )
    await loadData()
  }

  const saveItems = async items => {
    const user = await waitForUser()
    if (!user || !selectedRoster) return

    setSaving(true)
    try {
      await update(
        ref(database, `users/${user.uid}/datasets/${selectedDatasetId}/crewRosters/${selectedRoster.id}`),
        { items, updatedAt: Date.now() }
      )
      await loadData()
    } catch (err) {
      setError(`行路を保存できませんでした：${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const addTrain = async train => {
    if (!selectedRoster) return
    const items = Array.isArray(selectedRoster.items) ? selectedRoster.items : []

    const already = items.some(
      item => item?.type === "train" && String(item.trainId) === String(train.id)
    )
    if (already) {
      setShowTrainPicker(false)
      return
    }

    await saveItems([
      ...items,
      {
        type: "train",
        trainId: train.id,
        trainNo: train.trainNo || "",
        beforeChangeStation: "",
        afterChangeStation: "",
        addedAt: Date.now()
      }
    ])
    setShowTrainPicker(false)
    setTrainSearch("")
  }

  const addEvent = async () => {
    if (!selectedRoster || !eventStation.trim()) return
    const items = Array.isArray(selectedRoster.items) ? selectedRoster.items : []

    await saveItems([
      ...items,
      {
        type: eventType,
        station: eventStation.trim(),
        time: eventTime.trim(),
        addedAt: Date.now()
      }
    ])
    setEventStation("")
    setEventTime("")
  }

  const removeItem = async index => {
    if (!selectedRoster) return
    const items = Array.isArray(selectedRoster.items) ? selectedRoster.items : []
    await saveItems(items.filter((_, itemIndex) => itemIndex !== index))
  }

  const moveItem = async (index, direction) => {
    if (!selectedRoster) return
    const items = Array.isArray(selectedRoster.items) ? [...selectedRoster.items] : []
    const target = index + direction
    if (target < 0 || target >= items.length) return
    ;[items[index], items[target]] = [items[target], items[index]]
    await saveItems(items)
  }

  const getTrainStopStations = train => {
    const list = Array.isArray(train?.stations) ? train.stations : []
    const seen = new Set()
    return list.filter(station => {
      const name = String(station?.name || "").trim()
      if (!name || seen.has(name)) return false

      const stopType = Number(station?.stopType)
      const isPass = station?.isPass === true || stopType === 2
      const hasStopTime = Boolean(
        String(station?.arrival || "").trim() ||
        String(station?.departure || "").trim() ||
        String(station?.single || "").trim()
      )
      if (isPass || !hasStopTime) return false
      seen.add(name)
      return true
    })
  }

  const updateTrainChangeStation = async (itemIndex, field, value) => {
    if (!selectedRoster) return
    const items = Array.isArray(selectedRoster.items) ? [...selectedRoster.items] : []
    if (!items[itemIndex] || items[itemIndex].type !== "train") return
    items[itemIndex] = { ...items[itemIndex], [field]: value }
    await saveItems(items)
  }

  const pickerTrains = trains.filter(train => {
    const q = trainSearch.trim().toLowerCase()
    if (!q) return true
    return [
      train.trainNo,
      train.type,
      train.typeShort,
      firstStation(train),
      lastStation(train)
    ].some(value => String(value || "").toLowerCase().includes(q))
  })

  return (
    <div className="roster-page">
      <DatasetSelector />

      <header className="roster-header">
        <div>
          <p className="eyebrow">CREW ROSTER</p>
          <h1>行路組み立て</h1>
          <p>乗務員の担当列車と交代・休憩を時系列で組み立てます。</p>
        </div>
        <button onClick={createRoster} disabled={saving || !selectedDatasetId}>
          ＋ 行路を作成
        </button>
      </header>

      {error && <div className="roster-error">{error}</div>}

      {!selectedDatasetId ? (
        <div className="roster-empty">データセットを選択してください。</div>
      ) : loading ? (
        <div className="roster-empty">読み込み中...</div>
      ) : (
        <div className="roster-layout">
          <aside className="roster-list panel">
            <div className="panel-heading">
              <strong>行路一覧</strong>
              <span>{rosters.length}件</span>
            </div>

            {rosters.length === 0 ? (
              <div className="roster-list-empty">まだ行路がありません。</div>
            ) : rosters.map(roster => (
              <button
                key={roster.id}
                className={`roster-list-item ${roster.id === selectedRosterId ? "active" : ""}`}
                onClick={() => setSelectedRosterId(roster.id)}
              >
                <strong>{roster.name || "名称未設定"}</strong>
                <span>
                  {Array.isArray(roster.items) ? roster.items.filter(item => item?.type === "train").length : 0}列車
                </span>
              </button>
            ))}
          </aside>

          <main className="roster-editor panel">
            {!selectedRoster ? (
              <div className="roster-empty">左側から行路を選択してください。</div>
            ) : (
              <>
                <div className="roster-editor-head">
                  <div>
                    <p className="eyebrow">ROSTER</p>
                    <h2>{selectedRoster.name}</h2>
                    <span>{selectedRoster.crewType || "乗務員"}</span>
                  </div>
                  <div className="roster-actions">
                    <button className="secondary" onClick={renameRoster}>名称変更</button>
                    <button className="danger" onClick={deleteRoster}>削除</button>
                  </div>
                </div>

                <div className="roster-toolbar">
                  <button onClick={() => setShowTrainPicker(true)}>＋ 列車を追加</button>
                  <div className="event-form">
                    <select value={eventType} onChange={e => setEventType(e.target.value)}>
                      <option value="break">休憩</option>
                      <option value="wait">待機</option>
                      <option value="report">出勤</option>
                      <option value="finish">退勤</option>
                    </select>
                    <input
                      value={eventStation}
                      onChange={e => setEventStation(e.target.value)}
                      placeholder="駅・場所"
                    />
                    <input
                      value={eventTime}
                      onChange={e => setEventTime(e.target.value)}
                      placeholder="時刻"
                    />
                    <button onClick={addEvent} disabled={!eventStation.trim()}>追加</button>
                  </div>
                </div>

                <div className="roster-timeline">
                  {(Array.isArray(selectedRoster.items) ? selectedRoster.items : []).map((item, index) => {
                    const train = item?.type === "train"
                      ? trains.find(value => String(value.id) === String(item.trainId))
                      : null

                    if (item?.type === "train") {
                      return (
                        <div className="roster-item train-item" key={`${item.trainId}-${index}`}>
                          <div className="roster-time">
                            <strong>{trainTime(train, item) || "—"}</strong>
                            <span>{trainEndTime(train, item) || ""}</span>
                          </div>
                          <div className="roster-line-marker train-marker" />
                          <div className="roster-item-body">
                            <div className="roster-item-title">
                              <strong>{train?.trainNo || item.trainNo || "—"}</strong>
                              <span>{train?.typeShort || train?.type || "—"}</span>
                            </div>
                            <div className="roster-route">
                              {firstStation(train)} → {lastStation(train)}
                            </div>
                            <small>{train?.operation || train?.unyo || ""}</small>
                            <div className="train-change-menu">
                              <div className="train-change-menu-title">乗務員交代</div>
                              <div className="train-change-fields">
                                <label>前
                                  <select
                                    value={item?.beforeChangeStation || ""}
                                    onChange={e => updateTrainChangeStation(index, "beforeChangeStation", e.target.value)}
                                  >
                                    <option value="">交代なし</option>
                                    {getTrainStopStations(train).map(station => (
                                      <option key={`before-${station.name}`} value={station.name}>{station.name}</option>
                                    ))}
                                  </select>
                                </label>
                                <label>後
                                  <select
                                    value={item?.afterChangeStation || ""}
                                    onChange={e => updateTrainChangeStation(index, "afterChangeStation", e.target.value)}
                                  >
                                    <option value="">交代なし</option>
                                    {getTrainStopStations(train).map(station => (
                                      <option key={`after-${station.name}`} value={station.name}>{station.name}</option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                            </div>
                          </div>
                          <div className="roster-item-actions">
                            <button className="icon-button" onClick={() => moveItem(index, -1)}>↑</button>
                            <button className="icon-button" onClick={() => moveItem(index, 1)}>↓</button>
                            <button className="icon-button danger-text" onClick={() => removeItem(index)}>×</button>
                          </div>
                        </div>
                      )
                    }

                    const labels = {
                      change: "乗務員交代",
                      break: "休憩",
                      wait: "待機",
                      report: "出勤",
                      finish: "退勤"
                    }

                    return (
                      <div className="roster-item event-item" key={`event-${index}`}>
                        <div className="roster-time">
                          <strong>{item?.time || "—"}</strong>
                        </div>
                        <div className="roster-line-marker event-marker" />
                        <div className="roster-item-body">
                          <div className="roster-item-title">
                            <strong>{labels[item?.type] || "イベント"}</strong>
                          </div>
                          <div className="roster-route">{item?.station || "場所未設定"}</div>
                        </div>
                        <div className="roster-item-actions">
                          <button className="icon-button" onClick={() => moveItem(index, -1)}>↑</button>
                          <button className="icon-button" onClick={() => moveItem(index, 1)}>↓</button>
                          <button className="icon-button danger-text" onClick={() => removeItem(index)}>×</button>
                        </div>
                      </div>
                    )
                  })}

                  {(!Array.isArray(selectedRoster.items) || selectedRoster.items.length === 0) && (
                    <div className="roster-list-empty">
                      「列車を追加」から担当列車を追加してください。
                    </div>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      )}

      {showTrainPicker && (
        <div className="roster-modal-backdrop" onMouseDown={() => setShowTrainPicker(false)}>
          <div className="roster-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="roster-modal-head">
              <h2>列車を追加</h2>
              <button className="secondary" onClick={() => setShowTrainPicker(false)}>閉じる</button>
            </div>
            <input
              autoFocus
              value={trainSearch}
              onChange={e => setTrainSearch(e.target.value)}
              placeholder="列番・種別・駅名で検索"
            />
            <div className="train-picker-list">
              {pickerTrains.slice(0, 100).map(train => (
                <button
                  className="train-picker-item"
                  key={train.id}
                  onClick={() => addTrain(train)}
                >
                  <strong>{train.trainNo || "—"}</strong>
                  <span>{train.typeShort || train.type || "—"}</span>
                  <span>{firstStation(train)} → {lastStation(train)}</span>
                  <time>{trainTime(train) || "—"}</time>
                </button>
              ))}
              {pickerTrains.length === 0 && (
                <div className="roster-list-empty">該当する列車がありません。</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Roster

import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { get, ref } from "firebase/database"
import { database } from "../firebase/config"

function formatTime(value) {
  if (!value) return "—"
  const text = String(value).trim()
  if (text.length <= 4) return `${text.slice(0, -2) || "0"}:${text.slice(-2)}`
  return `${text.slice(0, -4) || "0"}:${text.slice(-4, -2)}`
}

function SharedDataset() {
  const { shareId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        const snapshot = await get(ref(database, `sharedDatasets/${shareId}`))
        if (!snapshot.exists()) {
          setError("この共有ダイヤは存在しないか、公開が終了しています。")
          return
        }
        setData(snapshot.val())
      } catch (err) {
        console.error("Shared dataset load error:", err)
        setError("共有ダイヤを読み込めませんでした。")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [shareId])

  if (loading) return <div><h1>共有ダイヤ</h1><p>読み込み中...</p></div>
  if (error) return <div><h1>共有ダイヤ</h1><p>{error}</p></div>

  const dataset = data?.dataset || {}
  const trains = Object.values(data?.trains || {})
  const lines = Object.values(data?.lines || {})
  const crewRosters = Object.entries(data?.crewRosters || {}).map(([id, roster]) => ({
    id,
    ...(roster || {}),
    items: Array.isArray(roster?.items) ? roster.items : []
  }))

  const trainMap = new Map(
    trains.map(train => [String(train.id || train.trainId || ""), train])
  )

  return (
    <div className="shared-dataset-page">
      <div className="page-hero">
        <div>
          <p className="eyebrow">Shared Dataset</p>
          <h1>{dataset.name || dataset.fileName || "共有ダイヤ"}</h1>
          <p>このページは共有URLから閲覧できる公開ダイヤです。</p>
        </div>
      </div>

      <div className="shared-dataset-summary">
        <div><span>路線</span><strong>{dataset.railwayName || "—"}</strong></div>
        <div><span>駅数</span><strong>{dataset.files?.[0]?.stations?.length || lines[0]?.stations?.length || 0}</strong></div>
        <div><span>列車数</span><strong>{trains.length}</strong></div>
        <div><span>行路数</span><strong>{crewRosters.length}</strong></div>
      </div>

      {lines.map((line, index) => (
        <section className="shared-line-card" key={index}>
          <h2>{line.name || line.railwayName || "路線"}</h2>
          <p>{Array.isArray(line.stations) ? `${line.stations.length}駅` : "駅情報なし"}</p>
        </section>
      ))}

      <section className="shared-trains-section">
        <h2>列車一覧</h2>
        {trains.length === 0 ? <p>列車データがありません。</p> : (
          <div className="shared-train-list">
            {trains
              .sort((a, b) => String(a.trainNo || "").localeCompare(String(b.trainNo || ""), undefined, { numeric: true }))
              .map((train, index) => {
                const stations = Array.isArray(train.stations) ? train.stations : []
                const first = stations[0] || {}
                const last = stations[stations.length - 1] || {}
                return (
                  <div className="shared-train-card" key={train.trainId || train.id || index}>
                    <strong>{train.trainNo || "—"}</strong>
                    <span>{train.typeShort || train.type || "—"}</span>
                    <span>{train.origin || first.name || "—"} → {train.destination || train.finalDest || last.name || "—"}</span>
                    <span>{formatTime(first.departure || first.dep || first.arrival || first.arr)} → {formatTime(last.arrival || last.arr || last.departure || last.dep)}</span>
                  </div>
                )
              })}
          </div>
        )}
      </section>

      <section className="shared-trains-section">
        <h2>スタフ・行路</h2>
        {crewRosters.length === 0 ? (
          <p>共有されている行路データがありません。</p>
        ) : (
          <div className="shared-roster-list">
            {crewRosters.map(roster => {
              const items = roster.items
              const trainItems = items.filter(item => item?.type === "train")

              return (
                <article className="shared-roster-card" key={roster.id}>
                  <div className="shared-roster-header">
                    <div>
                      <p className="eyebrow">ROSTER</p>
                      <h3>{roster.name || "名称未設定"}</h3>
                    </div>
                    <span>{roster.crewType || "乗務員"}</span>
                  </div>

                  <div className="shared-roster-sequence">
                    {items.length === 0 ? (
                      <span>行路内容なし</span>
                    ) : items.map((item, index) => {
                      if (item?.type !== "train") {
                        const labels = {
                          change: "乗務員交代",
                          break: "休憩",
                          wait: "待機",
                          report: "出勤",
                          finish: "退勤"
                        }
                        return (
                          <div className="shared-roster-event" key={`event-${index}`}>
                            <strong>{labels[item?.type] || "イベント"}</strong>
                            <span>{item?.time || "—"} / {item?.station || "場所未設定"}</span>
                          </div>
                        )
                      }

                      const train =
                        trainMap.get(String(item.trainId || "")) ||
                        trains.find(value => String(value.trainNo || "") === String(item.trainNo || ""))

                      return (
                        <div className="shared-roster-train" key={`train-${index}`}>
                          <strong>{train?.trainNo || item.trainNo || "—"}</strong>
                          <span>
                            {train
                              ? `${train.origin || train.stations?.[0]?.name || "—"} → ${train.destination || train.finalDest || train.stations?.[train.stations.length - 1]?.name || "—"}`
                              : "列車データなし"}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="shared-roster-meta">
                    <span>{trainItems.length}列車</span>
                    <span>行路ID: {roster.id}</span>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

export default SharedDataset

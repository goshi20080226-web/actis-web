import { useEffect, useMemo, useState } from "react"
import { ref, get } from "firebase/database"
import { onAuthStateChanged } from "firebase/auth"
import { Link, useParams } from "react-router-dom"
import { auth, database } from "../firebase/config"
import StaffCard from "../components/staff/StaffCard"
import DatasetSelector from "../components/dataset/DatasetSelector"
import { useDataset } from "../context/DatasetContext"

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

function getOperationLabel(train) {
  if (!train) return "運用未設定"

  const directValues = [
    train.unyo,
    train.operation,
    train.operationNo,
    train.operationNumber,
    train.unyoNo
  ]

  for (const value of directValues) {
    if (value === undefined || value === null) continue
    const text = String(value).trim()
    if (text && text !== "運用未設定") return text
  }

  const lines = Array.isArray(train.operationLines) ? train.operationLines : []

  for (const line of lines) {
    if (!line) continue

    const notes = Array.isArray(line.notes) ? line.notes : []
    for (const note of notes) {
      if (!note) continue
      for (const value of [note.unyo, note.operation, note.operationNo, note.operationNumber]) {
        if (value === undefined || value === null) continue
        const text = String(value).trim()
        if (text) return text
      }
    }

    const match = String(line.value || "").match(/\$\/([^,]+)/)
    if (match && match[1]) return match[1].trim()
  }

  return "運用未設定"
}

function sortTrains(a, b) {
  const aSeq = Number(a?.operationSequence)
  const bSeq = Number(b?.operationSequence)
  const aValid = Number.isFinite(aSeq)
  const bValid = Number.isFinite(bSeq)

  if (aValid && bValid) return aSeq - bSeq
  if (aValid) return -1
  if (bValid) return 1

  return String(a?.trainNo || "").localeCompare(
    String(b?.trainNo || ""),
    undefined,
    { numeric: true }
  )
}


function buildCrewChangeRemarks(rosters, trains) {
  const remarks = {}
  const trainById = new Map(trains.map(train => [String(train.id), train]))

  const addRemark = (trainId, station, text) => {
    if (!trainId || !station || !text) return
    const key = `${String(trainId)}::${String(station).trim()}`
    const existing = remarks[key]
    if (!existing) {
      remarks[key] = text
    } else if (!existing.split(" / ").includes(text)) {
      remarks[key] = `${existing} / ${text}`
    }
  }

  const rosterList = Array.isArray(rosters) ? rosters : []

  // 同じ列車を担当する2つの行路の「後交代」と「前交代」を結び、
  // 運用スタフの該当駅の記事へ「〇行路→〇行路」を追加する。
  for (const fromRoster of rosterList) {
    const fromItems = Array.isArray(fromRoster?.items) ? fromRoster.items : []

    for (const fromItem of fromItems) {
      if (fromItem?.type !== "train") continue

      const station = String(fromItem?.afterChangeStation || "").trim()
      if (!station) continue

      const trainId = String(fromItem.trainId || "")
      if (!trainId || !trainById.has(trainId)) continue

      for (const toRoster of rosterList) {
        if (String(toRoster?.id) === String(fromRoster?.id)) continue

        const toItems = Array.isArray(toRoster?.items) ? toRoster.items : []
        const sameTrain = toItems.some(item =>
          item?.type === "train" &&
          String(item?.trainId || "") === trainId &&
          String(item?.beforeChangeStation || "").trim() === station
        )

        if (sameTrain) {
          addRemark(
            trainId,
            station,
            `交代　${fromRoster.name || "行路"}→${toRoster.name || "行路"}`
          )
        }
      }
    }
  }

  return remarks
}

function getStationRemarksForTrain(remarks, trainId) {
  const result = {}
  const prefix = `${String(trainId)}::`
  for (const [key, value] of Object.entries(remarks || {})) {
    if (key.startsWith(prefix)) {
      result[key.slice(prefix.length)] = value
    }
  }
  return result
}

function StaffOperation() {
  const { selectedDatasetId } = useDataset()
  const { operationName } = useParams()
  const operation = decodeURIComponent(operationName || "")

  const [trains, setTrains] = useState([])
  const [crewChangeRemarks, setCrewChangeRemarks] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        setError("")

        const user = await getCurrentUser()
        if (!user) {
          setError("ACTISアカウントにログインしてください。")
          return
        }

        const [snapshot, rosterSnapshot] = await Promise.all([
          get(ref(database, `users/${user.uid}/trains`)),
          selectedDatasetId
            ? get(ref(database, `users/${user.uid}/datasets/${selectedDatasetId}/crewRosters`))
            : Promise.resolve({ exists: () => false })
        ])

        if (!snapshot.exists()) {
          setTrains([])
          setCrewChangeRemarks({})
          return
        }

        const data = snapshot.val() || {}
        const list = Object.entries(data).map(([id, train]) => ({
          id,
          ...train
        }))

        const filtered = list
          .filter(
            train =>
              String(
                train.datasetId || ""
              ) ===
              String(
                selectedDatasetId
              )
          )
          .filter(
            train =>
              getOperationLabel(train) ===
              operation
          )
          .sort(sortTrains)

        if (!cancelled) {
          const rosterValue = rosterSnapshot.exists() ? rosterSnapshot.val() : {}
          const rosterList = Object.entries(rosterValue || {}).map(([id, value]) => ({
            id,
            ...(value || {})
          }))
          setTrains(filtered)
          setCrewChangeRemarks(buildCrewChangeRemarks(rosterList, filtered))
        }
      } catch (err) {
        console.error("StaffOperation load error:", err)
        if (!cancelled) {
          setError(`運用スタフを取得できませんでした：${err.message}`)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [operation, selectedDatasetId])

  const directions = useMemo(() => {
    return [
      ...new Set(
        trains
          .map(train => train.direction === "Kudari" ? "下り" : train.direction === "Nobori" ? "上り" : "")
          .filter(Boolean)
      )
    ]
  }, [trains])

  if (loading) {
    return (
      <div className="staff-operation-page">
        <h1>運用スタフ</h1>
        <p>読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="staff-operation-page">
        <h1>運用スタフ</h1>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="staff-operation-page">
      <DatasetSelector />
      <div className="staff-operation-header">
        <div>
          <div className="staff-operation-kicker">運用スタフ</div>
          <h1>{operation}</h1>
          <p>
            {trains.length}列車
            {directions.length > 0 ? ` ・ ${directions.join(" / ")}` : ""}
          </p>
        </div>

        <Link to="/trains" className="staff-operation-back">
          運用一覧へ戻る
        </Link>
      </div>

      {trains.length === 0 ? (
        <div className="staff-operation-empty">
          この運用に属する列車がありません。
        </div>
      ) : (
        <div className="staff-operation-list">
          {trains.map((train, index) => (
            <section className="staff-operation-item" key={train.id || index}>
              <div className="staff-operation-index">
                {train.operationSequence || index + 1}
              </div>
              <StaffCard train={train} stationRemarks={getStationRemarksForTrain(crewChangeRemarks, train.id)} />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export default StaffOperation

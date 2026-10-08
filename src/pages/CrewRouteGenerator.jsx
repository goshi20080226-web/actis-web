import { useEffect, useMemo, useState } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { get, ref } from "firebase/database"
import { auth, database } from "../firebase/config"
import { useDataset } from "../context/DatasetContext"
import DatasetSelector from "../components/dataset/DatasetSelector"
import AdminGuard from "../components/AdminGuard"
import "./CrewRouteGenerator.css"

const emptyRoster = index => ({
  id: crypto.randomUUID(),
  name: `${index + 1}行路`,
  startStation: "",
  startTime: "",
  endTime: "",
  district: ""
})

const emptyDistrict = () => ({
  id: crypto.randomUUID(),
  name: "",
  from: "",
  to: ""
})

function timeToMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (minute > 59) return null
  return hour * 60 + minute
}

function formatTime(value) {
  if (!Number.isFinite(value)) return ""
  const minutes = ((Math.round(value) % 1440) + 1440) % 1440
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

function snapTime(value, step) {
  if (!value) return ""
  const minutes = timeToMinutes(value)
  if (minutes === null) return value
  return formatTime(Math.round(minutes / step) * step)
}

function stationName(station) {
  return String(
    station?.Ekimei ||
    station?.name ||
    station?.stationName ||
    station?.shortName ||
    station?.timeName ||
    ""
  ).trim()
}

function stationTime(station, preferArrival = false) {
  const raw = preferArrival
    ? station?.arrival || station?.single || station?.departure
    : station?.departure || station?.single || station?.arrival
  const text = String(raw || "").trim()
  if (!text) return null

  const colon = text.match(/^(\d{1,2})[:：](\d{2})(?::(\d{2}))?/)
  if (colon) {
    return Number(colon[1]) * 60 + Number(colon[2])
  }

  const digits = text.replace(/[^0-9]/g, "")
  if (digits.length < 3) return null
  const hour = Number(digits.slice(0, -2))
  const minute = Number(digits.slice(-2))
  if (minute > 59) return null
  return hour * 60 + minute
}

function sameStation(a, b) {
  return String(a || "").replace(/\s+/g, "").trim() ===
    String(b || "").replace(/\s+/g, "").trim()
}

function getTrainStations(train) {
  return Array.isArray(train?.stations) ? train.stations : []
}

function findStationIndex(stations, name, fromIndex = 0) {
  return stations.findIndex((station, index) =>
    index >= fromIndex && sameStation(stationName(station), name)
  )
}

function findNextChangeStation(stations, startIndex, changeSet, district) {
  for (let index = startIndex + 1; index < stations.length; index += 1) {
    const name = stationName(stations[index])
    if (!name) continue

    const isDistrictBoundary =
      district &&
      (sameStation(name, district.from) || sameStation(name, district.to))

    if (changeSet.has(name) || isDistrictBoundary) {
      return { index, station: stations[index] }
    }
  }

  return null
}

function hasDepotDeparture(train) {
  return Array.isArray(train?.operationRemarks) &&
    train.operationRemarks.some(remark => remark?.label === "出庫")
}

function trainKey(train) {
  return String(train?.id || train?.trainId || train?.trainNo || "")
}

function trainStartTime(train) {
  const stations = getTrainStations(train)
  if (!stations.length) return null
  return stationTime(stations[0])
}

function trainEndTime(train) {
  const stations = getTrainStations(train)
  if (!stations.length) return null
  return stationTime(stations[stations.length - 1], true)
}

function buildOperationChains(trains) {
  const map = new Map(trains.map(train => [String(train?.trainNo || ""), train]))
  const visited = new Set()
  const chains = []

  const starts = trains.filter(train => {
    const previous = String(train?.previousTrainNo || "")
    return !previous || !map.has(previous)
  })

  const walk = start => {
    const chain = []
    let current = start
    while (current && !visited.has(trainKey(current))) {
      visited.add(trainKey(current))
      chain.push(current)
      const nextNo = String(current?.nextTrainNo || "")
      current = nextNo ? map.get(nextNo) : null
    }
    return chain
  }

  starts
    .sort((a, b) => (trainStartTime(a) ?? Infinity) - (trainStartTime(b) ?? Infinity))
    .forEach(start => {
      const chain = walk(start)
      if (chain.length) chains.push(chain)
    })

  trains
    .filter(train => !visited.has(trainKey(train)))
    .sort((a, b) => (trainStartTime(a) ?? Infinity) - (trainStartTime(b) ?? Infinity))
    .forEach(train => {
      const chain = walk(train)
      if (chain.length) chains.push(chain)
    })

  return chains
}

function trainToLeg(train) {
  const stations = getTrainStations(train)
  if (!stations.length) return null
  const from = stationName(stations[0])
  const to = stationName(stations[stations.length - 1])
  const departure = stationTime(stations[0])
  const arrival = stationTime(stations[stations.length - 1], true)
  if (!from || !to || departure === null || arrival === null) return null

  let adjustedArrival = arrival
  if (adjustedArrival < departure) adjustedArrival += 1440
  if (adjustedArrival - departure > 12 * 60) return null

  return {
    trainId: trainKey(train),
    trainNo: train?.trainNo || train?.number || trainKey(train),
    type: train?.typeShort || train?.type || "列車",
    from,
    to,
    departure: formatTime(departure),
    arrival: formatTime(adjustedArrival),
    departureMinutes: departure,
    arrivalMinutes: adjustedArrival,
    train
  }
}

function splitChainAtChangeStations(chain, changeSet) {
  const segments = []
  let current = []

  for (const train of chain) {
    const leg = trainToLeg(train)
    if (!leg) continue
    current.push(leg)

    const reachesChange = changeSet.has(leg.to)
    if (reachesChange) {
      segments.push(current)
      current = []
    }
  }

  if (current.length) segments.push(current)
  return segments
}

function canConnectLegs(previous, current, changeSet) {
  if (!previous || !current) return false
  if (!sameStation(previous.to, current.from)) return false
  if (changeSet.has(previous.to)) return false
  return current.departureMinutes >= previous.arrivalMinutes
}

function buildPhysicalConnections(legs, changeSet) {
  const sorted = [...legs].sort((a, b) =>
    a.departureMinutes - b.departureMinutes ||
    a.arrivalMinutes - b.arrivalMinutes
  )
  const predecessor = new Map()
  const successor = new Map()

  // まず、各列車に対して「その列車へ最も自然につながる直前列車」を
  // 探します。同じ列車を2本以上の行路へ割り当てないようにします。
  for (const current of sorted) {
    let best = null

    for (const previous of sorted) {
      if (previous.trainId === current.trainId) continue
      if (successor.has(previous.trainId)) continue
      if (predecessor.has(current.trainId)) continue
      if (!canConnectLegs(previous, current, changeSet)) continue

      const gap = current.departureMinutes - previous.arrivalMinutes
      if (!best || gap < best.gap) {
        best = { previous, gap }
      }
    }

    if (best) {
      predecessor.set(current.trainId, best.previous.trainId)
      successor.set(best.previous.trainId, current.trainId)
    }
  }

  const byId = new Map(sorted.map(leg => [leg.trainId, leg]))
  const routes = []
  const visited = new Set()

  // 先頭列車からたどることで、1本の乗務行路として連続した列車をまとめます。
  for (const leg of sorted) {
    if (predecessor.has(leg.trainId) || visited.has(leg.trainId)) continue

    const route = []
    let current = leg
    while (current && !visited.has(current.trainId)) {
      visited.add(current.trainId)
      route.push(current)
      const nextId = successor.get(current.trainId)
      current = nextId ? byId.get(nextId) : null
    }

    if (route.length) routes.push(route)
  }

  // 循環や不正なリンクがあった場合も、列車を取りこぼさない。
  for (const leg of sorted) {
    if (!visited.has(leg.trainId)) routes.push([leg])
  }

  return routes
}

function buildAutomaticRoutes(trains, changeSet) {
  const validLegs = trains.map(trainToLeg).filter(Boolean)
  if (!validLegs.length) return []

  const trainMap = new Map(
    trains
      .filter(train => trainKey(train))
      .map(train => [trainKey(train), train])
  )

  // OUD2の明示的な運用リンクを最優先で確定する。
  const explicitChains = buildOperationChains(trains)
  const routes = []
  const assigned = new Set()

  for (const chain of explicitChains) {
    if (chain.length < 2) continue

    const segments = splitChainAtChangeStations(chain, changeSet)
    for (const segment of segments) {
      const usable = segment.filter(leg => {
        if (assigned.has(leg.trainId)) return false
        assigned.add(leg.trainId)
        return true
      })
      if (usable.length) routes.push(usable)
    }
  }

  // 明示的な運用リンクがない列車は、駅・時刻から物理的な接続を推定する。
  // これにより、OUD2側にnextTrainNoが保存されていなくても、
  // 「到着→同駅発車」の列車を同一行路へまとめられる。
  const remaining = validLegs.filter(leg => !assigned.has(leg.trainId))
  const physicalRoutes = buildPhysicalConnections(remaining, changeSet)

  for (const route of physicalRoutes) {
    const usable = route.filter(leg => {
      if (assigned.has(leg.trainId)) return false
      assigned.add(leg.trainId)
      return true
    })
    if (usable.length) routes.push(usable)
  }

  // 最後の安全弁。どの列車も必ずちょうど1回だけ割り当てる。
  for (const leg of validLegs) {
    if (!assigned.has(leg.trainId)) {
      assigned.add(leg.trainId)
      routes.push([leg])
    }
  }

  return routes
}

function routeScore(routes, trains) {
  const assigned = new Set(routes.flat().map(item => item.trainId))
  const validTrainCount = trains.filter(trainToLeg).length
  const coverage = validTrainCount ? assigned.size / validTrainCount : 0

  let gaps = 0
  let singleTrainRoutes = 0
  let connectedTrainCount = 0

  for (const route of routes) {
    if (route.length === 1) {
      singleTrainRoutes += 1
      continue
    }

    connectedTrainCount += route.length

    for (let i = 1; i < route.length; i += 1) {
      const previous = route[i - 1]
      const current = route[i]
      const currentGap = current.departureMinutes - previous.arrivalMinutes
      if (currentGap >= 0) gaps += currentGap
    }
  }

  // 全列車を割り当てることを最優先にしつつ、
  // 行路数を減らし、1行路に複数列車をまとめることを強く評価する。
  return (
    coverage * 1000000 -
    routes.length * 10000 -
    singleTrainRoutes * 3000 +
    connectedTrainCount * 100 -
    gaps
  )
}

function mergeCompatibleRoutes(routes, changeSet) {
  const result = routes.map(route => [...route])

  let changed = true
  while (changed) {
    changed = false

    outer:
    for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        const left = result[i]
        const right = result[j]
        if (!left.length || !right.length) continue

        const candidates = [
          [left, right],
          [right, left]
        ]

        for (const [first, second] of candidates) {
          const last = first[first.length - 1]
          const next = second[0]

          if (!canConnectLegs(last, next, changeSet)) continue

          const merged = [...first, ...second]
          result[i] = merged
          result.splice(j, 1)
          changed = true
          break outer
        }
      }
    }
  }

  return result
}

function suggestRoutePlan(trains, changeSet) {
  let routes = buildAutomaticRoutes(trains, changeSet)

  // 単独列車が発生している場合は、既存行路の終端と接続できる
  // 別行路の先頭を探して、1行路あたり複数列車になるよう再結合する。
  routes = mergeCompatibleRoutes(routes, changeSet)

  const depotCount = trains.filter(hasDepotDeparture).length
  const assignedCount = new Set(routes.flat().map(item => item.trainId)).size

  return {
    routes,
    routeCount: routes.length,
    depotCount,
    trainCount: trains.length,
    assignedCount,
    score: routeScore(routes, trains)
  }
}

function chooseInitialTrain(trains, startStation, targetMinutes, reservedTrainIds = new Set(), rosterIndex = 0) {
  const candidates = []

  for (const train of trains) {
    const trainId = String(train?.id || train?.trainId || train?.trainNo || "")
    if (!trainId || reservedTrainIds.has(trainId)) continue

    const stations = getTrainStations(train)
    if (!stations.length) continue

    const index = startStation
      ? findStationIndex(stations, startStation)
      : 0

    if (index < 0) continue

    const departure = stationTime(stations[index])
    if (departure === null) continue

    // 出勤駅・勤務時間が未指定なら、OUD2の運用情報で明示された
    // 「出庫」列車だけを候補にする。
    if (targetMinutes === null && !startStation) {
      if (!hasDepotDeparture(train)) continue
      candidates.push({ train, stations, index, departure, score: departure })
      continue
    }

    if (targetMinutes === null) {
      candidates.push({ train, stations, index, departure, score: departure })
      continue
    }

    const delta = departure - targetMinutes
    if (delta < -15 || delta > 30) continue

    candidates.push({ train, stations, index, departure, score: Math.abs(delta) })
  }

  candidates.sort((a, b) => a.score - b.score || a.departure - b.departure)

  // 条件が完全未指定のときも、同じ出庫列車を全行路で重複使用しない。
  return candidates[rosterIndex % Math.max(candidates.length, 1)] || null
}

function generateRoster(config, trains, changeStations, district, rosterIndex = 0, reservedTrainIds = new Set()) {
  const start = timeToMinutes(config.startTime)
  const end = timeToMinutes(config.endTime)
  const hasStartStation = Boolean(config.startStation)
  const hasStartTime = start !== null
  const hasEndTime = end !== null

  // 条件が完全未指定でも、出庫電車を起点に自動生成できるようにする。
  // 終了時刻だけ未指定の場合は、最初の行路を最後まで追う。
  if (hasStartTime && hasEndTime && !config.startStation) {
    // 出勤駅だけ未指定でも時刻から出庫電車を選べるようにする。
  }

  const endLimit = hasEndTime
    ? (hasStartTime && end < start ? end + 1440 : end)
    : null

  const items = []
  const used = new Set()
  let currentStation = config.startStation
  let cursor = hasStartTime ? start - 15 : null

  for (let guard = 0; guard < 40; guard += 1) {
    const candidate = chooseInitialTrain(
      trains,
      currentStation,
      cursor === null ? null : cursor % 1440,
      reservedTrainIds,
      items.length === 0 ? rosterIndex : 0
    )
    if (!candidate) break

    const trainId = String(candidate.train?.id || candidate.train?.trainId || candidate.train?.trainNo || "")
    if (!trainId || used.has(trainId)) break

    const stations = candidate.stations
    const nextChange = findNextChangeStation(
      stations,
      candidate.index,
      changeStations,
      district
    )

    const finalIndex = nextChange ? nextChange.index : stations.length - 1
    const fromStation = stationName(stations[candidate.index])
    const toStation = stationName(stations[finalIndex])
    const depart = stationTime(stations[candidate.index])
    const arrive = stationTime(stations[finalIndex], true)

    if (!fromStation || !toStation || depart === null || arrive === null) break

    let adjustedArrive = arrive
    if (adjustedArrive < depart) adjustedArrive += 1440

    // 1本の列車が日跨ぎで20時間以上走ることは通常あり得ないため、
    // 時刻データの終端/欠損による誤解釈を候補から除外する。
    const travelMinutes = adjustedArrive - depart
    if (travelMinutes < 0 || travelMinutes > 12 * 60) continue

    if (hasStartTime && depart < start - 30) break
    if (endLimit !== null && adjustedArrive > endLimit + 20) break

    items.push({
      trainId,
      trainNo: candidate.train?.trainNo || candidate.train?.number || trainId,
      type: candidate.train?.typeShort || candidate.train?.type || "列車",
      from: fromStation,
      to: toStation,
      departure: formatTime(depart),
      arrival: formatTime(adjustedArrive),
      reason: items.length === 0 && !hasStartStation ? "出庫電車" : ""
    })

    used.add(trainId)

    if (endLimit !== null && adjustedArrive >= endLimit - 15) break
    if (!nextChange) break

    currentStation = toStation
    cursor = adjustedArrive + 5
  }

  const first = items[0]
  const last = items[items.length - 1]
  const inferredStart = first?.departure || ""
  const inferredEnd = last?.arrival || ""

  return {
    ...config,
    status: items.length > 0 ? "生成済み" : "候補なし",
    items,
    actualStart: inferredStart,
    actualEnd: inferredEnd,
    inferredStartStation: !hasStartStation ? first?.from || "" : "",
    inferredByDepotTrain: !hasStartStation && Boolean(first)
  }
}

function CrewRouteGeneratorPage() {
  const { selectedDatasetId } = useDataset()
  const [trains, setTrains] = useState([])
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [step, setStep] = useState(5)
  const [rosterCount, setRosterCount] = useState(10)
  const [changeStations, setChangeStations] = useState([])
  const [districts, setDistricts] = useState([])
  const [rosters, setRosters] = useState(() =>
    Array.from({ length: 10 }, (_, index) => emptyRoster(index))
  )
  const [results, setResults] = useState([])
  const [autoPlan, setAutoPlan] = useState(null)
  const [usingAutoPlan, setUsingAutoPlan] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError("")
        const user = await new Promise(resolve => {
          if (auth.currentUser) {
            resolve(auth.currentUser)
            return
          }
          const unsubscribe = onAuthStateChanged(auth, currentUser => {
            unsubscribe()
            resolve(currentUser)
          })
        })

        if (!user) {
          setError("ACTISアカウントにログインしてください。")
          return
        }

        const [trainSnapshot, lineSnapshot] = await Promise.all([
          get(ref(database, `users/${user.uid}/trains`)),
          get(ref(database, `users/${user.uid}/lines`))
        ])

        if (cancelled) return

        const trainObject = trainSnapshot.exists() ? trainSnapshot.val() : {}
        const lineObject = lineSnapshot.exists() ? lineSnapshot.val() : {}

        setTrains(
          Object.entries(trainObject)
            .map(([id, value]) => ({ id, ...(value || {}) }))
            .filter(train =>
              !selectedDatasetId ||
              String(train.datasetId || "") === String(selectedDatasetId)
            )
        )

        setLines(
          Object.entries(lineObject)
            .map(([id, value]) => ({ id, ...(value || {}) }))
            .filter(line =>
              !selectedDatasetId ||
              String(line.datasetId || "") === String(selectedDatasetId)
            )
        )
      } catch (err) {
        console.error("Crew route generator load error:", err)
        if (!cancelled) setError(`ダイヤデータを取得できませんでした：${err.message}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [selectedDatasetId])

  const suggestedPlan = useMemo(() => {
    if (!trains.length) return null
    return suggestRoutePlan(trains, new Set(changeStations.filter(Boolean)))
  }, [trains, changeStations])

  const stationOptions = useMemo(() => {
    const result = []
    const seen = new Set()

    for (const line of lines) {
      for (const station of Array.isArray(line?.stations) ? line.stations : []) {
        const name = stationName(station)
        if (!name || seen.has(name)) continue
        seen.add(name)
        result.push(name)
      }
    }

    for (const train of trains) {
      for (const station of getTrainStations(train)) {
        const name = stationName(station)
        if (!name || seen.has(name)) continue
        seen.add(name)
        result.push(name)
      }
    }

    return result
  }, [lines, trains])

  function updateRoster(id, key, value) {
    setUsingAutoPlan(false)
    setRosters(current =>
      current.map(roster =>
        roster.id === id
          ? { ...roster, [key]: key.endsWith("Time") ? snapTime(value, step) : value }
          : roster
      )
    )
  }

  function setCount(value) {
    setUsingAutoPlan(false)
    setAutoPlan(null)
    const next = Math.max(1, Math.min(100, Number(value) || 1))
    setRosterCount(next)
    setRosters(current => {
      const rows = [...current]
      while (rows.length < next) rows.push(emptyRoster(rows.length))
      return rows.slice(0, next)
    })
  }

  function addChangeStation() {
    setUsingAutoPlan(false)
    setAutoPlan(null)
    setChangeStations(current => [...current, ""])
  }

  function updateChangeStation(index, value) {
    setUsingAutoPlan(false)
    setAutoPlan(null)
    setChangeStations(current =>
      current.map((station, stationIndex) =>
        stationIndex === index ? value : station
      )
    )
  }

  function addDistrict() {
    setDistricts(current => [...current, emptyDistrict()])
  }

  function updateDistrict(id, key, value) {
    setUsingAutoPlan(false)
    setAutoPlan(null)
    setDistricts(current =>
      current.map(district =>
        district.id === id ? { ...district, [key]: value } : district
      )
    )
  }

  function calculateAutoPlan() {
    const validChangeStations = changeStations.filter(Boolean)
    const plan = suggestedPlan || suggestRoutePlan(trains, new Set(validChangeStations))
    setAutoPlan(plan)
    setCount(plan.routeCount)
    setUsingAutoPlan(true)
    setRosters(plan.routes.map((route, index) => ({
      id: crypto.randomUUID(),
      name: `${index + 1}行路`,
      startStation: route[0]?.from || "",
      startTime: route[0]?.departure || "",
      endTime: route[route.length - 1]?.arrival || "",
      district: ""
    })))
    return plan
  }

  function generate() {
    const validChangeStations = changeStations.filter(Boolean)
    const changeSet = new Set(validChangeStations)

    // 自動提案を適用した状態なら、その計画をそのまま採用する。
    if (usingAutoPlan) {
      const plan = autoPlan || suggestRoutePlan(trains, changeSet)
      setAutoPlan(plan)
      setCount(plan.routeCount)
      setUsingAutoPlan(true)
      setRosters(plan.routes.map((route, index) => ({
        id: crypto.randomUUID(),
        name: `${index + 1}行路`,
        startStation: route[0]?.from || "",
        startTime: route[0]?.departure || "",
        endTime: route[route.length - 1]?.arrival || "",
        district: ""
      })))
      setResults(plan.routes.map((route, index) => ({
        id: crypto.randomUUID(),
        name: `${index + 1}行路`,
        status: "生成済み",
        items: route,
        actualStart: route[0]?.departure || "",
        actualEnd: route[route.length - 1]?.arrival || "",
        inferredStartStation: route[0]?.from || "",
        inferredByDepotTrain: hasDepotDeparture(route[0]?.train)
      })))
      return
    }

    const reservedInitialTrainIds = new Set()
    const generated = rosters.map((roster, index) => {
      const district = districts.find(item => item.name && item.name === roster.district)
      const result = generateRoster(
        roster,
        trains,
        changeSet,
        district,
        index,
        reservedInitialTrainIds
      )

      if (result.items[0]?.trainId) {
        reservedInitialTrainIds.add(result.items[0].trainId)
      }

      return result
    })

    setResults(generated)
  }

  if (loading) {
    return <div className="crew-route-page"><p>ダイヤデータを読み込み中...</p></div>
  }

  if (error) {
    return <div className="crew-route-page"><h1>乗務行路自動生成</h1><p className="crew-route-error">{error}</p></div>
  }

  return (
    <div className="crew-route-page">
      <DatasetSelector />

      <header className="crew-route-header">
        <div>
          <p className="crew-route-eyebrow">DEVELOPER EXPERIMENT</p>
          <h1>乗務行路自動生成</h1>
          <p>ダイヤと大まかな勤務条件から、乗務員行路の候補を自動生成します。</p>
        </div>
        <div className="crew-route-badge">開発者専用</div>
      </header>

      <section className="crew-route-panel">
        <div className="crew-route-panel-header">
          <div>
            <h2>基本条件</h2>
            <p>全体の行路数と、開始・終了時刻の刻みを設定します。</p>
          </div>
        </div>

        <div className="crew-route-grid">
          <label>
            <span>行路数</span>
            <input type="number" min="1" max="100" value={rosterCount} onChange={event => setCount(event.target.value)} />
          </label>
          <label>
            <span>時刻単位</span>
            <select value={step} onChange={event => setStep(Number(event.target.value))}>
              <option value="5">5分</option>
              <option value="10">10分</option>
            </select>
          </label>
          <div className="crew-route-data-state">
            <strong>{trains.length}</strong>
            <span>読込列車数</span>
          </div>
          <div className="crew-route-data-state">
            <strong>{stationOptions.length}</strong>
            <span>駅数</span>
          </div>
        </div>
      </section>

      <section className="crew-route-panel">
        <div className="crew-route-panel-header">
          <div>
            <h2>乗務員交代可能駅</h2>
            <p>行路の接続候補として使用します。</p>
          </div>
          <button type="button" onClick={addChangeStation}>駅を追加</button>
        </div>

        <div className="crew-route-chip-list">
          {changeStations.length === 0 && <p className="crew-route-muted">まだ指定されていません。</p>}
          {changeStations.map((station, index) => (
            <div className="crew-route-inline-row" key={`change-${index}`}>
              <select value={station} onChange={event => updateChangeStation(index, event.target.value)}>
                <option value="">駅を選択</option>
                {stationOptions.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <button type="button" className="secondary" onClick={() => setChangeStations(current => current.filter((_, i) => i !== index))}>削除</button>
            </div>
          ))}
        </div>
      </section>

      <section className="crew-route-panel">
        <div className="crew-route-panel-header">
          <div>
            <h2>乗務区</h2>
            <p>担当区間の境界駅を行路生成時の分割点として扱います。</p>
          </div>
          <button type="button" onClick={addDistrict}>乗務区を追加</button>
        </div>

        <div className="crew-route-district-list">
          {districts.length === 0 && <p className="crew-route-muted">乗務区を設定しない場合は、交代可能駅だけで生成します。</p>}
          {districts.map(district => (
            <div className="crew-route-district" key={district.id}>
              <input placeholder="乗務区名" value={district.name} onChange={event => updateDistrict(district.id, "name", event.target.value)} />
              <select value={district.from} onChange={event => updateDistrict(district.id, "from", event.target.value)}>
                <option value="">担当区間 始点</option>
                {stationOptions.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <select value={district.to} onChange={event => updateDistrict(district.id, "to", event.target.value)}>
                <option value="">担当区間 終点</option>
                {stationOptions.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <button type="button" className="secondary" onClick={() => setDistricts(current => current.filter(item => item.id !== district.id))}>削除</button>
            </div>
          ))}
        </div>
      </section>

      <section className="crew-route-panel">
        <div className="crew-route-panel-header">
          <div>
            <h2>行路数の自動提案</h2>
            <p>OUD2の運用つながりと交代駅を見て、全列車を1回ずつ割り当てられる行路数を算出します。</p>
          </div>
          <button type="button" onClick={calculateAutoPlan} disabled={trains.length === 0}>おすすめを適用</button>
        </div>
        {suggestedPlan && (
          <div className="crew-route-auto-summary">
            <strong>おすすめ {suggestedPlan.routeCount}行路</strong>
            <span>全{suggestedPlan.trainCount}列車中 {suggestedPlan.assignedCount}列車を割当</span>
            {suggestedPlan.depotCount > 0 && <span>出庫列車 {suggestedPlan.depotCount}本</span>}
          </div>
        )}
      </section>

            <section className="crew-route-panel">
        <div className="crew-route-panel-header">
          <div>
            <h2>各行路の希望条件</h2>
            <p>未指定の項目はダイヤから自動推定します。出勤駅・勤務時間をすべて空欄にすると、出庫電車を起点に行路を作成します。</p>
          </div>
        </div>

        <div className="crew-route-table-wrap">
          <table className="crew-route-table">
            <thead>
              <tr>
                <th>行路</th>
                <th>出勤駅</th>
                <th>乗務開始</th>
                <th>乗務終了</th>
                <th>乗務区</th>
              </tr>
            </thead>
            <tbody>
              {rosters.map((roster, index) => (
                <tr key={roster.id}>
                  <td>{index + 1}</td>
                  <td>
                    <select value={roster.startStation} onChange={event => updateRoster(roster.id, "startStation", event.target.value)}>
                      <option value="">指定なし（自動）</option>
                      {stationOptions.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </td>
                  <td><input type="time" step={step * 60} value={roster.startTime} onChange={event => updateRoster(roster.id, "startTime", event.target.value)} /></td>
                  <td><input type="time" step={step * 60} value={roster.endTime} onChange={event => updateRoster(roster.id, "endTime", event.target.value)} /></td>
                  <td>
                    <select value={roster.district} onChange={event => updateRoster(roster.id, "district", event.target.value)}>
                      <option value="">指定なし</option>
                      {districts.filter(item => item.name).map(district => <option key={district.id} value={district.name}>{district.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="crew-route-generate-bar">
          <p>{trains.length > 0 ? "現在のデータセットのダイヤを使って候補を生成します。" : "列車データがありません。"}</p>
          <button type="button" onClick={generate} disabled={trains.length === 0}>行路を自動生成</button>
        </div>
      </section>

      {results.length > 0 && (
        <section className="crew-route-panel">
          <div className="crew-route-panel-header">
            <div>
              <h2>生成結果</h2>
              <p>現在は実験用の候補生成です。条件を変えて何度でも再生成できます。</p>
            </div>
            <strong>{results.filter(result => result.items.length > 0).length} / {results.length} 行路生成</strong>
          </div>

          <div className="crew-route-results">
            {results.map((result, index) => (
              <article className="crew-route-result" key={result.id}>
                <div className="crew-route-result-head">
                  <div>
                    <strong>{index + 1}行路</strong>
                    <span>{result.startStation || result.inferredStartStation || "出勤駅自動"}</span>
                  </div>
                  <span className={result.items.length ? "result-ok" : "result-ng"}>{result.status}</span>
                </div>

                {result.items.length > 0 ? (
                  <>
                    <div className="crew-route-result-summary">
                      <span>実乗務 {result.actualStart} ～ {result.actualEnd}</span>
                      <span>{result.items.length}本</span>
                    </div>
                    <div className="crew-route-result-items">
                      {result.items.map((item, itemIndex) => (
                        <div className="crew-route-leg" key={`${item.trainId}-${itemIndex}`}>
                          <span>{item.departure}</span>
                          <strong>{item.trainNo}</strong>
                          <span>{item.type}</span>
                          <span>{item.from} → {item.to}</span>
                          <span>{item.arrival}</span>
                          {item.reason && <em>{item.reason}</em>}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="crew-route-muted">条件に合う列車を見つけられませんでした。</p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default function CrewRouteGenerator() {
  return (
    <AdminGuard>
      <CrewRouteGeneratorPage />
    </AdminGuard>
  )
}

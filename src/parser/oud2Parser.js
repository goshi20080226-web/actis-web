/* ACTIS OUD2 Parser
 *
 * OUD2 -> ACTIS JSON
 *
 * This revision removes the unresolved Git conflict and keeps both OUD2
 * type colors separately:
 * JikokuhyouMojiColor = text color
 * JikokuhyouBackColor = background color
 * OUD2 8-digit color is 00BBGGRR -> CSS #RRGGBB.
 */

function normalizeTime(time) { if (!time) return ""; return String(time).trim() }
function normalizeOperationTime(raw) {
  if (!raw) return ""
  const value = String(raw).replace(/[^0-9]/g, "")
  if (value.length < 3) return ""
  if (value.length <= 4) return `${value.slice(0, -2) || "0"}:${value.slice(-2)}`
  const hour = value.slice(0, -4) || "0", minute = value.slice(-4, -2), second = value.slice(-2)
  return second === "00" ? `${hour}:${minute}` : `${hour}:${minute}:${second}`
}
function extractOperationTrackKey(value) {
  const text = String(value || ""), firstToken = text.split(",")[0] || text
  let match = firstToken.match(/^\s*\d+\/(\d+)/)
  if (match) return match[1]
  match = firstToken.match(/\$\/(\d+)/)
  return match ? match[1] : ""
}
function parseOperationNotes(rawValue, side) {
  const notes = []
  if (!rawValue) return notes
  String(rawValue).split(",").forEach(token => {
    const value = token.trim(); if (!value) return
    const parts = value.split("$"), head = (parts[0] || "").trim(), trackKey = extractOperationTrackKey(value)
    if (/^5\s*\/\s*\$?0\s*$/.test(value) || /^5\s*\/\s*$/.test(head)) return
    const depotMatch = head.match(/^3\/(\d{3,6})/)
    if (depotMatch) { notes.push({ label: side === "A" ? "入区" : "出庫", time: depotMatch[1], side, trackKey: "" }); return }
    let time = ""
    for (let i = 1; i < parts.length; i++) { const match = String(parts[i] || "").match(/(\d{3,6})\/(\d{0,6})/); if (match) { time = match[1]; break } }
    if (!time) { const match = value.match(/\$(\d{3,6})\//); if (match) time = match[1] }
    if (time) notes.push({ label: "入換発", time, side, trackKey })
  })
  const seen = new Set()
  return notes.filter(note => { const key = `${note.label}|${note.time}|${note.trackKey}`; if (seen.has(key)) return false; seen.add(key); return true })
}
function parseOperationLine(train, line) {
  if (!train || !line) return
  const match = String(line).match(/^Operation(\d+)([AB])=(.*)$/); if (!match) return
  const rawIndex = parseInt(match[1], 10), side = match[2], value = match[3] || ""
  if (!Array.isArray(train.operationLines)) train.operationLines = []
  const notes = parseOperationNotes(value, side)
  train.operationLines.push({ rawIndex, side, value, notes })
  if (!Array.isArray(train.operationRemarks)) train.operationRemarks = []
  notes.forEach(note => train.operationRemarks.push({ rawIndex, side, label: note.label, time: normalizeOperationTime(note.time), trackKey: note.trackKey || "" }))
  const operationMatch = value.match(/\$\/([^,]+)/)
  if (operationMatch && operationMatch[1] && !train.unyo) train.unyo = operationMatch[1].trim()
}
function parseEkiJikoku(text) {
  if (!text) return []
  return String(text).split(",").map(value => {
    if (!value) return { arrival: "", departure: "", single: "", trackIdx: "", isPass: false, stopType: "3", typeChangeRef: null }
    let temp = value.trim(), dollarParts = temp.split("$"), trackIdx = ""
    if (dollarParts.length > 1) { temp = dollarParts[0]; trackIdx = dollarParts[1] || "" }
    let stopType = "1", arrival = "", departure = "", single = "", semicolon = temp.indexOf(";")
    if (semicolon !== -1) {
      stopType = temp.slice(0, semicolon); const time = temp.slice(semicolon + 1)
      if (time.includes("/")) { const parts = time.split("/"); arrival = normalizeTime(parts[0]); departure = normalizeTime(parts[1]) } else single = normalizeTime(time)
    } else stopType = temp
    return { arrival, departure, single, trackIdx, isPass: stopType === "2", stopType, typeChangeRef: null }
  })
}
function getTrackDisplay(station, trackIdx) {
  if (trackIdx === "" || trackIdx === null || trackIdx === undefined) return ""
  const tracks = Array.isArray(station?.tracks) ? station.tracks : []; if (!tracks.length) return ""
  const raw = String(trackIdx).trim(); if (!raw) return ""
  const numeric = /^-?\d+$/.test(raw) ? Number(raw) : NaN
  if (Number.isInteger(numeric)) {
    if (numeric >= 0 && numeric < tracks.length && String(tracks[numeric] ?? "").trim() !== "") return String(tracks[numeric]).trim()
    const oneBased = numeric - 1
    if (oneBased >= 0 && oneBased < tracks.length && String(tracks[oneBased] ?? "").trim() !== "") return String(tracks[oneBased]).trim()
  }
  const exact = tracks.find(value => String(value ?? "").trim() === raw)
  return exact !== undefined ? String(exact).trim() : ""
}
function createStationTimes(stations, ekiJikoku, direction, operationRemarks = []) {
  const result = [], count = Math.min(stations.length, ekiJikoku.length)
  for (let i = 0; i < count; i++) {
    const raw = ekiJikoku[i] || {}, stationIndex = direction === "Nobori" ? stations.length - 1 - i : i, station = stations[stationIndex]; if (!station) continue
    result.push({ rawIndex: i, name: station.name || "", shortName: station.timeName || "", diagramName: station.diagramName || "", trackIdx: raw.trackIdx || "", track: getTrackDisplay(station, raw.trackIdx), tracks: Array.isArray(station.tracks) ? [...station.tracks] : [], arrival: raw.arrival || "", departure: raw.departure || "", single: raw.single || "", isPass: raw.isPass === true, stopType: raw.stopType ?? "1", typeChangeRef: raw.typeChangeRef, remarks: "", operationRemarks: operationRemarks.filter(remark => Number(remark.rawIndex) === i) })
  }
  let start = -1, end = -1
  result.forEach((station, index) => { if (station.stopType === "0" || station.stopType === "3") return; if (start === -1) start = index; end = index })
  if (start === -1 || end === -1) return []
  const display = []
  for (let i = start; i <= end; i++) {
    const station = result[i]; if (!station || station.stopType === "0" || station.stopType === "3") continue
    let arrival = station.arrival, departure = station.departure
    if (station.single !== "") { if (i === end) arrival = station.single; else departure = station.single }
    if (i === start) arrival = ""; if (i === end) departure = ""
    display.push({ ...station, arrival, departure })
  }
  return display
}
function timeToSec(time) {
  if (time === undefined || time === null || String(time).trim() === "") return -1
  const value = String(time).replace(/[^0-9]/g, ""); if (!value) return -1
  let hour, minute, second = 0
  if (value.length <= 4) { hour = parseInt(value.slice(0, -2) || "0", 10); minute = parseInt(value.slice(-2), 10) }
  else { hour = parseInt(value.slice(0, -4) || "0", 10); minute = parseInt(value.slice(-4, -2), 10); second = parseInt(value.slice(-2), 10) }
  if (Number.isNaN(hour) || Number.isNaN(minute)) return -1
  return hour * 3600 + minute * 60 + second
}
function normalizeStation(name) { return String(name || "").replace(/\s+/g, "").trim() }
function resolveOperationStation(train, operation) {
  if (!train || !Array.isArray(train.stations) || !operation) return null
  const row = train.stations.find(station => Number(station.rawIndex) === Number(operation.rawIndex)); if (row) return row
  return operation.side === "B" ? (train.stations[0] || null) : (train.stations[train.stations.length - 1] || null)
}
function buildOperationEvents(train) {
  if (!train || !Array.isArray(train.operationLines) || !train.operationLines.length) return []
  const events = []
  train.operationLines.forEach(operation => {
    const station = resolveOperationStation(train, operation); if (!station) return
    const notes = Array.isArray(operation.notes) ? operation.notes : [], note = notes.find(item => item && item.time); if (!note) return
    const sec = timeToSec(note.time); if (sec < 0) return
    events.push({ role: operation.side === "B" ? "out" : "in", side: operation.side, station: station.name || "", rawIndex: operation.rawIndex, time: note.time, sec, trackKey: note.trackKey || "", train })
  })
  return events
}
function hasOperationSide(train, side) {
  if (!train || !Array.isArray(train.operationLines)) return false
  return train.operationLines.some(operation => operation && operation.side === side && (Array.isArray(operation.notes) ? operation.notes : []).some(note => note && note.time))
}
function linkTrainsByOperation(sortedTrains) {
  const inEvents = [], outEvents = []
  sortedTrains.forEach(train => { train.operationTurnback = null; buildOperationEvents(train).forEach(event => event.role === "in" ? inEvents.push(event) : outEvents.push(event)) })
  inEvents.sort((a, b) => a.sec - b.sec); outEvents.sort((a, b) => a.sec - b.sec)
  inEvents.forEach(inEvent => {
    const current = inEvent.train; if (!current || current.nextTrainNo) return
    let best = null, bestDiff = Infinity
    outEvents.forEach(outEvent => {
      const candidate = outEvent.train
      if (!candidate || candidate === current || candidate.previousTrainNo) return
      if (normalizeStation(inEvent.station) !== normalizeStation(outEvent.station)) return
      if (outEvent.sec < inEvent.sec) return
      if (inEvent.trackKey && outEvent.trackKey && String(inEvent.trackKey) !== String(outEvent.trackKey)) return
      const diff = outEvent.sec - inEvent.sec; if (diff < bestDiff) { bestDiff = diff; best = outEvent }
    })
    if (!best) return
    const next = best.train; current.nextTrainNo = next.trainNo || ""; next.previousTrainNo = current.trainNo || ""
    current.operationTurnback = { station: inEvent.station, inTime: inEvent.time, outTime: best.time, trackKey: inEvent.trackKey || best.trackKey || "" }
  })
}
function linkPhysicalTrains(sortedTrains) {
  const linkedAsNext = new Set(); sortedTrains.forEach(train => { if (train.nextTrainNo) linkedAsNext.add(String(train.nextTrainNo)) })
  sortedTrains.forEach(train => {
    if (train.nextTrainNo || hasOperationSide(train, "A") || !Array.isArray(train.stations) || !train.stations.length) return
    const last = train.stations[train.stations.length - 1], endTime = timeToSec(last.arrival || last.departure || last.single); if (endTime < 0) return
    let best = null, bestDiff = Infinity
    sortedTrains.forEach(candidate => {
      if (candidate === train || (candidate.trainNo && linkedAsNext.has(String(candidate.trainNo))) || hasOperationSide(candidate, "B") || candidate.previousTrainNo || !Array.isArray(candidate.stations) || !candidate.stations.length) return
      const first = candidate.stations[0], startTime = timeToSec(first.departure || first.arrival || first.single); if (startTime < 0 || startTime < endTime) return
      if (normalizeStation(last.name) !== normalizeStation(first.name)) return
      if (last.track && first.track && String(last.track) !== String(first.track)) return
      const diff = startTime - endTime; if (diff < bestDiff) { bestDiff = diff; best = candidate }
    })
    if (best) { train.nextTrainNo = best.trainNo || ""; best.previousTrainNo = train.trainNo || ""; linkedAsNext.add(String(best.trainNo || "")) }
  })
}
function assignOperations(trains) {
  const trainMap = new Map(); trains.forEach(train => { if (train.trainNo) trainMap.set(String(train.trainNo), train) })
  const groups = [], visited = new Set()
  trains.forEach(train => {
    if (visited.has(train) || train.previousTrainNo) return
    const group = []; let current = train
    while (current && !visited.has(current)) { group.push(current); visited.add(current); current = current.nextTrainNo ? trainMap.get(String(current.nextTrainNo)) : null }
    if (group.length) groups.push(group)
  })
  trains.forEach(train => { if (!visited.has(train)) { groups.push([train]); visited.add(train) } })
  groups.forEach(group => {
    let knownUnyo = ""; for (const train of group) if (train.unyo && String(train.unyo).trim() !== "") { knownUnyo = String(train.unyo).trim(); break }
    if (!knownUnyo) return
    group.forEach((train, index) => { if (!train.unyo || String(train.unyo).trim() === "") train.unyo = knownUnyo; train.operationSequence = index + 1; train.operationLength = group.length })
  })
  return groups
}
function analyzeOperations(trains) {
  trains.forEach(train => { train.nextTrainNo = ""; train.previousTrainNo = ""; train.operationSequence = null; train.operationLength = null; train.operationTurnback = null })
  const sortedTrains = [...trains].sort((a, b) => { const aFirst = a.stations?.[0], bFirst = b.stations?.[0]; return timeToSec(aFirst?.departure || aFirst?.arrival || aFirst?.single) - timeToSec(bFirst?.departure || bFirst?.arrival || bFirst?.single) })
  linkTrainsByOperation(sortedTrains); linkPhysicalTrains(sortedTrains); return assignOperations(sortedTrains)
}

function parseOud2(text, fileName = "") {
  const lines = String(text).replace(/\r/g, "").split("\n")
  const result = { fileName, fileType: "", railwayName: "", downAlias: "", upAlias: "", stations: [], trainTypes: [], diagrams: [], trains: { Kudari: [], Nobori: [] } }
  let section = "", inEkiTrack2 = false, currentStation = null, currentTrainType = null, currentDiagram = null, currentTrain = null

  for (const rawLine of lines) {
    const line = rawLine.trim(); if (!line) continue
    if (line === ".") { if (inEkiTrack2) { inEkiTrack2 = false; continue }; currentStation = null; currentTrainType = null; currentDiagram = null; currentTrain = null; continue }
    if (line === "EkiTrack2." && currentStation) { inEkiTrack2 = true; continue }
    if (line === "Eki.") { inEkiTrack2 = false; section = "Eki"; currentStation = { name: "", timeName: "", diagramName: "", timeFormat: "", scale: "", downMain: "", upMain: "", tracks: [] }; result.stations.push(currentStation); continue }
    if (line === "Ressyasyubetsu.") { section = "Ressyasyubetsu"; currentTrainType = { name: "", abbreviation: "", trainTypeColor: "", JikokuhyouMojiColor: "", JikokuhyouBackColor: "", index: result.trainTypes.length }; result.trainTypes.push(currentTrainType); continue }
    if (line === "Dia.") { section = "Dia"; currentDiagram = { name: "", Kudari: [], Nobori: [] }; result.diagrams.push(currentDiagram); continue }
    if (line === "Kudari.") { section = "Kudari"; continue }
    if (line === "Nobori.") { section = "Nobori"; continue }
    if (line === "Ressya.") { currentTrain = { direction: section, typeIndex: null, trainNo: "", unyo: "", timeRaw: "", stations: [], operations: {}, operationLines: [], operationRemarks: [] }; if (section === "Kudari") result.trains.Kudari.push(currentTrain); if (section === "Nobori") result.trains.Nobori.push(currentTrain); continue }

    const equalIndex = line.indexOf("="); if (equalIndex === -1) continue
    const key = line.slice(0, equalIndex), value = line.slice(equalIndex + 1)
    if (key === "FileType") { result.fileType = value; continue }
    if (key === "Rosenmei") { result.railwayName = value; continue }
    if (key === "KudariDiaAlias") { result.downAlias = value; continue }
    if (key === "NoboriDiaAlias") { result.upAlias = value; continue }

    if (section === "Eki" && currentStation) {
      if (key === "Ekimei") currentStation.name = value
      else if (key === "EkimeiJikokuRyaku") currentStation.timeName = value
      else if (key === "EkimeiDiaRyaku") currentStation.diagramName = value
      else if (key === "Ekijikokukeisiki") currentStation.timeFormat = value
      else if (key === "Ekikibo") currentStation.scale = value
      else if (key === "DownMain") currentStation.downMain = value
      else if (key === "UpMain") currentStation.upMain = value
      else if (key === "TrackRyakusyou") currentStation.tracks.push(value)
      continue
    }

    if (section === "Ressyasyubetsu" && currentTrainType) {
      if (key === "Syubetsumei") currentTrainType.name = value
      else if (key === "Ryakusyou") currentTrainType.abbreviation = value
      else if (key === "JikokuhyouMojiColor") {
        const color = String(value || "").trim().replace(/^0x/i, "")
        if (/^[0-9A-Fa-f]{8}$/.test(color)) { currentTrainType.JikokuhyouMojiColor = "#" + color.slice(6, 8) + color.slice(4, 6) + color.slice(2, 4); currentTrainType.trainTypeColor = currentTrainType.JikokuhyouMojiColor }
        else if (/^[0-9A-Fa-f]{6}$/.test(color)) { currentTrainType.JikokuhyouMojiColor = "#" + color; currentTrainType.trainTypeColor = currentTrainType.JikokuhyouMojiColor }
      }
      else if (key === "JikokuhyouBackColor") currentTrainType.JikokuhyouBackColor = String(value || "").trim().replace(/^0x/i, "")
      continue
    }

    if (section === "Dia" && currentDiagram) { if (key === "DiaName") currentDiagram.name = value; continue }
    if (currentTrain) {
      if (key.startsWith("Operation")) { parseOperationLine(currentTrain, line); continue }
      if (key === "Unyo" || key === "UnYo") { if (!currentTrain.unyo) currentTrain.unyo = value.trim(); continue }
      if (key === "Houkou") { currentTrain.direction = value; continue }
      if (key === "Syubetsu") { currentTrain.typeIndex = Number(value); continue }
      if (key === "Ressyabangou") { currentTrain.trainNo = value; continue }
      if (key === "EkiJikoku") { currentTrain.timeRaw = value; const ekiJikoku = parseEkiJikoku(value); currentTrain.rawTimes = ekiJikoku; currentTrain.stations = createStationTimes(result.stations, ekiJikoku, section, currentTrain.operationRemarks); continue }
    }
  }

  for (const direction of ["Kudari", "Nobori"]) for (const train of result.trains[direction]) {
    const type = result.trainTypes[train.typeIndex] || null
    train.type = type?.name || ""; train.typeShort = type?.abbreviation || ""; train.trainTypeColor = type?.JikokuhyouMojiColor || type?.trainTypeColor || ""; train.JikokuhyouMojiColor = type?.JikokuhyouMojiColor || ""; train.JikokuhyouBackColor = type?.JikokuhyouBackColor || ""
    if (train.stations?.length > 0) train.destination = train.stations[train.stations.length - 1].name
  }
  analyzeOperations([...result.trains.Kudari, ...result.trains.Nobori])
  return result
}

export default parseOud2

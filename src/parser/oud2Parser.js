function normalizeTime(value) {
  return value == null ? "" : String(value).trim()
}

function timeToSeconds(value) {
  const text = normalizeTime(value).replace(/[^0-9]/g, "")
  if (!text) return -1

  let hour
  let minute
  let second = 0

  if (text.length <= 4) {
    hour = Number(text.slice(0, -2) || 0)
    minute = Number(text.slice(-2))
  } else {
    hour = Number(text.slice(0, -4) || 0)
    minute = Number(text.slice(-4, -2))
    second = Number(text.slice(-2))
  }

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second)
  ) {
    return -1
  }

  return hour * 3600 + minute * 60 + second
}

function normalizeStationName(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .trim()
}

function normalizeOperationTime(value) {
  const text = String(value || "").replace(/[^0-9]/g, "")
  if (!text) return ""

  if (text.length <= 4) {
    return `${text.slice(0, -2) || "0"}:${text.slice(-2)}`
  }

  const hour = text.slice(0, -4) || "0"
  const minute = text.slice(-4, -2)
  const second = text.slice(-2)

  return second === "00"
    ? `${hour}:${minute}`
    : `${hour}:${minute}:${second}`
}

function getFirstStation(train) {
  return Array.isArray(train?.stations)
    ? train.stations[0] || null
    : null
}

function getLastStation(train) {
  return Array.isArray(train?.stations)
    ? train.stations[train.stations.length - 1] || null
    : null
}

function extractOperationTrackKey(value) {
  const text = String(value || "")
  const first = text.split(",")[0] || text

  let match = first.match(/^\s*\d+\/(\d+)/)
  if (match) return match[1]

  match = first.match(/\$\/(\d+)/)
  if (match) return match[1]

  return ""
}

function parseOperationNotes(rawValue, side) {
  if (!rawValue) return []

  const notes = []

  for (const token of String(rawValue).split(",")) {
    const value = token.trim()
    if (!value) continue

    const parts = value.split("$")
    const head = (parts[0] || "").trim()
    const trackKey = extractOperationTrackKey(value)

    if (
      /^5\s*\/\s*\$?0\s*$/.test(value) ||
      /^5\s*\/\s*$/.test(head)
    ) {
      continue
    }

    const depotMatch = head.match(/^3\/(\d{3,6})/)
    if (depotMatch) {
      notes.push({
        label: side === "A" ? "入区" : "出庫",
        time: depotMatch[1],
        side,
        trackKey: ""
      })
      continue
    }

    let time = ""

    for (let i = 1; i < parts.length; i++) {
      const match = String(parts[i] || "").match(/(\d{3,6})\/(\d{0,6})/)
      if (match) {
        time = match[1]
        break
      }
    }

    if (!time) {
      const match = value.match(/\$(\d{3,6})\//)
      if (match) time = match[1]
    }

    if (time) {
      notes.push({
        label: "入換発",
        time,
        side,
        trackKey
      })
    }
  }

  const seen = new Set()

  return notes.filter(note => {
    const key = `${note.label}|${note.time}|${note.trackKey}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function parseOperationLine(train, line) {
  if (!train || !line) return

  const match = String(line).match(
    /^Operation(\d+)([AB])=(.*)$/
  )

  if (!match) return

  const rawIndex = Number(match[1])
  const side = match[2]
  const value = match[3] || ""

  const notes = parseOperationNotes(value, side)

  if (!Array.isArray(train.operationLines)) {
    train.operationLines = []
  }

  train.operationLines.push({
    rawIndex,
    side,
    value,
    notes
  })

  if (!Array.isArray(train.operationRemarks)) {
    train.operationRemarks = []
  }

  for (const note of notes) {
    train.operationRemarks.push({
      rawIndex,
      side,
      label: note.label,
      time: normalizeOperationTime(note.time),
      trackKey: note.trackKey || ""
    })
  }

  const operationMatch = value.match(/\$\/([^,]+)/)

  if (
    operationMatch &&
    operationMatch[1] &&
    !train.unyo
  ) {
    train.unyo = operationMatch[1].trim()
  }
}

function parseEkiJikoku(value) {
  if (!value) return []

  return String(value).split(",").map(item => {
    if (!item) {
      return {
        arrival: "",
        departure: "",
        single: "",
        trackIdx: "",
        isPass: false,
        stopType: "3",
        typeChangeRef: null
      }
    }

    let text = item.trim()
    let trackIdx = ""

    const dollarIndex = text.indexOf("$")

    if (dollarIndex !== -1) {
      trackIdx = text.slice(dollarIndex + 1)
      text = text.slice(0, dollarIndex)
    }

    let stopType = "1"
    let arrival = ""
    let departure = ""
    let single = ""

    const semicolon = text.indexOf(";")

    if (semicolon !== -1) {
      stopType = text.slice(0, semicolon)

      const time = text.slice(semicolon + 1)

      if (time.includes("/")) {
        const parts = time.split("/")
        arrival = normalizeTime(parts[0])
        departure = normalizeTime(parts[1])
      } else {
        single = normalizeTime(time)
      }
    } else {
      stopType = text
    }

    return {
      arrival,
      departure,
      single,
      trackIdx,
      isPass: stopType === "2",
      stopType,
      typeChangeRef: null
    }
  })
}

function getTrackDisplay(station, trackIdx) {
  if (
    trackIdx === "" ||
    trackIdx == null
  ) {
    return ""
  }

  if (
    !station ||
    !Array.isArray(station.tracks)
  ) {
    return String(trackIdx)
  }

  const index = Number.parseInt(trackIdx, 10)

  if (Number.isNaN(index)) {
    return String(trackIdx)
  }

  if (
    station.tracks[index] !== undefined &&
    station.tracks[index] !== ""
  ) {
    return station.tracks[index]
  }

  return String(trackIdx)
}

function createStationTimes(
  stations,
  ekiJikoku,
  direction,
  operationRemarks = []
) {
  if (
    !Array.isArray(stations) ||
    !Array.isArray(ekiJikoku)
  ) {
    return []
  }

  const result = []
  const count = Math.min(
    stations.length,
    ekiJikoku.length
  )

  for (let i = 0; i < count; i++) {
    const raw = ekiJikoku[i] || {}

    const stationIndex =
      direction === "Nobori"
        ? stations.length - 1 - i
        : i

    const station = stations[stationIndex]

    if (!station) continue

    const stationOperationRemarks =
      operationRemarks.filter(
        remark =>
          Number(remark.rawIndex) === i
      )

    result.push({
      rawIndex: i,
      name: station.name || "",
      shortName: station.timeName || "",
      diagramName: station.diagramName || "",
      trackIdx: raw.trackIdx || "",
      track: getTrackDisplay(
        station,
        raw.trackIdx
      ),
      arrival: raw.arrival || "",
      departure: raw.departure || "",
      single: raw.single || "",
      isPass: raw.isPass === true,
      stopType: raw.stopType ?? "1",
      typeChangeRef: raw.typeChangeRef ?? null,
      remarks: "",
      operationRemarks:
        stationOperationRemarks
    })
  }

  let start = -1
  let end = -1

  result.forEach((station, index) => {
    if (
      station.stopType === "0" ||
      station.stopType === "3"
    ) {
      return
    }

    if (start === -1) {
      start = index
    }

    end = index
  })

  if (start === -1 || end === -1) {
    return []
  }

  const display = []

  for (let i = start; i <= end; i++) {
    const station = result[i]
    if (!station) continue

    if (
      station.stopType === "0" ||
      station.stopType === "3"
    ) {
      continue
    }

    let arrival = station.arrival
    let departure = station.departure

    if (station.single !== "") {
      if (i === end) {
        arrival = station.single
      } else {
        departure = station.single
      }
    }

    if (i === start) {
      arrival = ""
    }

    if (i === end) {
      departure = ""
    }

    display.push({
      ...station,
      arrival,
      departure
    })
  }

  return display
}

function resolveOperationStation(train, operation) {
  if (
    !train ||
    !Array.isArray(train.stations) ||
    !operation
  ) {
    return null
  }

  const row = train.stations.find(
    station =>
      Number(station.rawIndex) ===
      Number(operation.rawIndex)
  )

  if (row) return row

  if (operation.side === "B") {
    return train.stations[0] || null
  }

  return (
    train.stations[
      train.stations.length - 1
    ] || null
  )
}

function buildOperationEvents(train) {
  if (
    !train ||
    !Array.isArray(train.operationLines)
  ) {
    return []
  }

  const events = []

  for (const operation of train.operationLines) {
    const station =
      resolveOperationStation(
        train,
        operation
      )

    if (!station) continue

    const notes =
      Array.isArray(operation.notes)
        ? operation.notes
        : []

    const note = notes.find(
      item => item && item.time
    )

    if (!note) continue

    const sec = timeToSeconds(note.time)

    if (sec < 0) continue

    events.push({
      role:
        operation.side === "B"
          ? "out"
          : "in",
      side: operation.side,
      station: station.name || "",
      rawIndex: operation.rawIndex,
      time: note.time,
      sec,
      trackKey: note.trackKey || "",
      train
    })
  }

  return events
}

function hasOperationSide(train, side) {
  if (
    !train ||
    !Array.isArray(train.operationLines)
  ) {
    return false
  }

  return train.operationLines.some(
    operation => {
      if (
        !operation ||
        operation.side !== side
      ) {
        return false
      }

      const notes =
        Array.isArray(operation.notes)
          ? operation.notes
          : []

      return notes.some(
        note =>
          note &&
          note.time
      )
    }
  )
}

function clearTrainLinks(trains) {
  for (const train of trains) {
    train.nextTrain = null
    train.previousTrain = null
    train.nextTrainNo = ""
    train.previousTrainNo = ""
    train.operationSequence = null
    train.operationLength = null
    train.operationTurnback = null
  }
}

function linkTrainsByOperation(trains) {
  const inEvents = []
  const outEvents = []

  for (const train of trains) {
    for (
      const event of
      buildOperationEvents(train)
    ) {
      if (event.role === "in") {
        inEvents.push(event)
      } else {
        outEvents.push(event)
      }
    }
  }

  inEvents.sort(
    (a, b) => a.sec - b.sec
  )

  outEvents.sort(
    (a, b) => a.sec - b.sec
  )

  for (const inEvent of inEvents) {
    const current = inEvent.train

    if (
      !current ||
      current.nextTrain
    ) {
      continue
    }

    let best = null
    let bestDiff = Infinity

    for (const outEvent of outEvents) {
      const candidate = outEvent.train

      if (
        !candidate ||
        candidate === current ||
        candidate.previousTrain
      ) {
        continue
      }

      if (
        normalizeStationName(
          inEvent.station
        ) !==
        normalizeStationName(
          outEvent.station
        )
      ) {
        continue
      }

      if (
        outEvent.sec <
        inEvent.sec
      ) {
        continue
      }

      if (
        inEvent.trackKey &&
        outEvent.trackKey &&
        String(inEvent.trackKey) !==
        String(outEvent.trackKey)
      ) {
        continue
      }

      const diff =
        outEvent.sec -
        inEvent.sec

      if (diff < bestDiff) {
        bestDiff = diff
        best = outEvent
      }
    }

    if (!best) continue

    const next = best.train

    current.nextTrain = next
    next.previousTrain = current

    current.nextTrainNo =
      next.trainNo || ""

    next.previousTrainNo =
      current.trainNo || ""

    current.operationTurnback = {
      station: inEvent.station,
      inTime: inEvent.time,
      outTime: best.time,
      trackKey:
        inEvent.trackKey ||
        best.trackKey ||
        ""
    }
  }
}

function linkPhysicalTrains(trains) {
  const usedNext = new Set()

  for (const train of trains) {
    if (train.nextTrain) {
      usedNext.add(train.nextTrain)
    }
  }

  for (const train of trains) {
    if (train.nextTrain) continue

    if (
      hasOperationSide(
        train,
        "A"
      )
    ) {
      continue
    }

    const last =
      getLastStation(train)

    if (!last) continue

    const endTime =
      timeToSeconds(
        last.arrival ||
        last.departure ||
        last.single
      )

    if (endTime < 0) continue

    let best = null
    let bestDiff = Infinity

    for (const candidate of trains) {
      if (
        candidate === train ||
        usedNext.has(candidate) ||
        candidate.previousTrain
      ) {
        continue
      }

      if (
        hasOperationSide(
          candidate,
          "B"
        )
      ) {
        continue
      }

      const first =
        getFirstStation(candidate)

      if (!first) continue

      if (
        normalizeStationName(
          last.name
        ) !==
        normalizeStationName(
          first.name
        )
      ) {
        continue
      }

      const startTime =
        timeToSeconds(
          first.departure ||
          first.arrival ||
          first.single
        )

      if (startTime < 0) continue

      if (startTime < endTime) {
        continue
      }

      if (
        last.track &&
        first.track &&
        String(last.track) !==
        String(first.track)
      ) {
        continue
      }

      const diff =
        startTime - endTime

      if (diff < bestDiff) {
        bestDiff = diff
        best = candidate
      }
    }

    if (!best) continue

    train.nextTrain = best
    best.previousTrain = train

    train.nextTrainNo =
      best.trainNo || ""

    best.previousTrainNo =
      train.trainNo || ""

    usedNext.add(best)

    if (!train.operationTurnback) {
      train.operationTurnback = {
        station: last.name || "",
        inTime:
          last.arrival ||
          last.departure ||
          last.single ||
          "",
        outTime:
          getFirstStation(best)?.departure ||
          getFirstStation(best)?.arrival ||
          getFirstStation(best)?.single ||
          "",
        trackKey:
          last.track ||
          getFirstStation(best)?.track ||
          ""
      }
    }
  }
}

function buildOperationGroups(trains) {
  const groups = []
  const visited = new Set()

  for (const train of trains) {
    if (visited.has(train)) continue
    if (train.previousTrain) continue

    const group = []
    let current = train

    while (
      current &&
      !visited.has(current)
    ) {
      group.push(current)
      visited.add(current)
      current = current.nextTrain
    }

    if (group.length) {
      groups.push(group)
    }
  }

  for (const train of trains) {
    if (visited.has(train)) continue

    groups.push([train])
    visited.add(train)
  }

  return groups
}

function assignOperations(trains) {
  const groups =
    buildOperationGroups(trains)

  for (const group of groups) {
    let knownUnyo = ""

    for (const train of group) {
      const value =
        String(train.unyo || "").trim()

      if (value) {
        knownUnyo = value
        break
      }
    }

    for (
      let index = 0;
      index < group.length;
      index++
    ) {
      const train = group[index]

      if (
        !train.unyo &&
        knownUnyo
      ) {
        train.unyo = knownUnyo
      }

      train.operationSequence =
        index + 1

      train.operationLength =
        group.length
    }
  }

  return groups
}

function addAutoRemarksToTrains(trains = []) {

  if (!Array.isArray(trains)) {
    return
  }

  const normalize = (value) =>
    String(value ?? "").trim()


  const getSyubetsuColor = (name) => {

    const text =
      String(name || "")

    if (text.includes("特急")) {
      return "#cc0000"
    }

    if (text.includes("快急")) {
      return "#ff00ff"
    }

    if (text.includes("快速")) {
      return "#0000ff"
    }

    if (text.includes("急行")) {
      return "#ff8800"
    }

    if (
      text.includes("準急") ||
      text.includes("通急")
    ) {
      return "#008800"
    }

    if (text.includes("普通")) {
      return "#000000"
    }

    if (text.includes("回送")) {
      return "#888888"
    }

    return "#333333"
  }


  const addRemark = (
    station,
    train,
    kind
  ) => {

    if (
      !station ||
      !train ||
      !kind
    ) {
      return
    }


    if (
      !Array.isArray(
        station.autoRemarks
      )
    ) {
      station.autoRemarks = []
    }


    const trainNo =
      normalize(
        train.trainNo
      )


    const trainType =
      normalize(
        train.typeShort ||
        train.type
      )


    if (
      !trainNo &&
      !trainType
    ) {
      return
    }


    const text =
      trainType
        ? `${trainNo} ${trainType}${kind}`
        : `${trainNo}${kind}`


    const remark = {

      text,

      trainNo,

      trainType,

      trainTypeColor:
        getSyubetsuColor(
          trainType
        ),

      kind

    }


    const exists =
      station.autoRemarks.some(
        item =>
          item &&
          item.text ===
            remark.text
      )


    if (!exists) {

      station.autoRemarks.push(
        remark
      )

    }

  }


  // ========================================
  // 初期化
  // ========================================

  for (
    const train
    of trains
  ) {

    if (
      !Array.isArray(
        train?.stations
      )
    ) {
      continue
    }


    for (
      const station
      of train.stations
    ) {

      if (!station) {
        continue
      }


      station.autoRemarks = []

    }

  }


  // ========================================
  // 待避・連絡
  // ========================================

  for (
    const trainA
    of trains
  ) {

    if (
      !Array.isArray(
        trainA?.stations
      )
    ) {
      continue
    }


    for (
      const trainB
      of trains
    ) {

      if (
        trainA === trainB
      ) {
        continue
      }


      // 同方向のみ
      if (
        trainA.direction !==
        trainB.direction
      ) {
        continue
      }


      for (
        const stationA
        of trainA.stations
      ) {

        if (!stationA) {
          continue
        }


        const stationName =
          normalize(
            stationA.name
          )


        if (!stationName) {
          continue
        }


        const stationB =
          trainB.stations.find(
            station =>
              normalize(
                station?.name
              ) ===
              stationName
          )


        if (!stationB) {
          continue
        }


        let secAArrival =
          timeToSeconds(
            stationA.arrival ||
            stationA.arr
          )


        let secADeparture =
          timeToSeconds(
            stationA.departure ||
            stationA.dep
          )


        if (
          secAArrival === -1 &&
          secADeparture === -1
        ) {
          continue
        }


        if (
          secAArrival === -1
        ) {
          secAArrival =
            secADeparture
        }


        if (
          secADeparture === -1
        ) {
          secADeparture =
            secAArrival
        }


        let secBArrival =
          timeToSeconds(
            stationB.arrival ||
            stationB.arr
          )


        let secBDeparture =
          timeToSeconds(
            stationB.departure ||
            stationB.dep
          )


        if (
          secBArrival === -1 &&
          secBDeparture === -1
        ) {
          continue
        }


        if (
          secBArrival === -1
        ) {
          secBArrival =
            secBDeparture
        }


        if (
          secBDeparture === -1
        ) {
          secBDeparture =
            secBArrival
        }


        // ==============================
        // 待避
        // ==============================

        if (
          secAArrival <=
            secBArrival &&
          secBDeparture <
            secADeparture
        ) {

          addRemark(
            stationA,
            trainB,
            "待避"
          )

        }


        // ==============================
        // 連絡
        // ==============================

        const isPassA =
          stationA.isPass === true ||
          stationA.pass === true


        if (
          !isPassA &&
          secBArrival <=
            secAArrival &&
          secAArrival <=
            secBDeparture
        ) {

          addRemark(
            stationA,
            trainB,
            "連絡"
          )

        }

      }

    }

  }


  // ========================================
  // 既存備考・Operation備考を統合
  // ========================================

  for (
    const train
    of trains
  ) {

    if (
      !Array.isArray(
        train?.stations
      )
    ) {
      continue
    }


    for (
      const station
      of train.stations
    ) {

      if (!station) {
        continue
      }


      const autoRemarks =
        Array.isArray(
          station.autoRemarks
        )
          ? station.autoRemarks
          : []


      const operationRemarks =
        Array.isArray(
          station.operationRemarks
        )
          ? station.operationRemarks
          : []


      const operationTexts =
        operationRemarks
          .map(
            remark => {

              if (!remark) {
                return ""
              }


              if (
                typeof remark ===
                "string"
              ) {
                return remark
              }


              const parts = []


              if (
                remark.label
              ) {
                parts.push(
                  remark.label
                )
              }


              if (
                remark.time
              ) {
                parts.push(
                  remark.time
                )
              }


              if (
                remark.trackName
              ) {
                parts.push(
                  remark.trackName
                )
              }


              return parts.join(" ")

            }
          )
          .filter(Boolean)


      const existing =
        normalize(
          station.remarks
        )


      station.automaticRemarks =
        autoRemarks


      station.remarks =
        [
          ...(existing
            ? [existing]
            : []),

          ...autoRemarks.map(
            remark =>
              remark.text
          ),

          ...operationTexts

        ]
          .filter(Boolean)
          .filter(
            (
              value,
              index,
              array
            ) =>
              array.indexOf(
                value
              ) === index
          )
          .join("\n")


      delete station.autoRemarks

    }

  }

}

function cleanTrainForFirebase(train) {
  if (!train) return

  delete train.rawTimes
  /* Operation情報はスタフ表示で使用するため保持 */
  delete train.operations

  delete train.nextTrain
  delete train.previousTrain
}

function colorValueToCss(value) {
  const text =
    String(value || "")
      .trim()
      .replace(/^0x/i, "")

  if (!/^[0-9a-fA-F]{8}$/.test(text)) {
    return ""
  }

  return `#${text.slice(2)}`.toLowerCase()
}

function parseOud2(
  text,
  fileName = ""
) {
  const lines =
    String(text ?? "")
      .replace(/\r/g, "")
      .split("\n")

  const result = {
    fileName,
    fileType: "",
    railwayName: "",
    downAlias: "",
    upAlias: "",
    stations: [],
    trainTypes: [],
    diagrams: [],
    trains: {
      Kudari: [],
      Nobori: []
    }
  }

  let section = ""
  let currentStation = null
  let currentTrainType = null
  let currentDiagram = null
  let currentTrain = null

  for (const rawLine of lines) {
    const line =
      rawLine.trim()

    if (!line) continue

    if (line === ".") {
      currentStation = null
      currentTrainType = null
      currentDiagram = null
      currentTrain = null

      // sectionは保持する。
      continue
    }

    if (line === "Eki.") {
      section = "Eki"

      currentStation = {
        name: "",
        timeName: "",
        diagramName: "",
        timeFormat: "",
        scale: "",
        downMain: "",
        upMain: "",
        tracks: []
      }

      result.stations.push(
        currentStation
      )

      continue
    }

    if (
      line ===
      "Ressyasyubetsu."
    ) {
      section =
        "Ressyasyubetsu"

      currentTrainType = {
        name: "",
        abbreviation: "",
        color: "#000000",
        backgroundColor: "#ffffff",
        fontIndex: "",
        index:
          result.trainTypes.length
      }

      result.trainTypes.push(
        currentTrainType
      )

      continue
    }

    if (line === "Dia.") {
      section = "Dia"

      currentDiagram = {
        name: "",
        Kudari: [],
        Nobori: []
      }

      result.diagrams.push(
        currentDiagram
      )

      continue
    }

    if (line === "Kudari.") {
      section = "Kudari"
      continue
    }

    if (line === "Nobori.") {
      section = "Nobori"
      continue
    }

    if (line === "Ressya.") {
      currentTrain = {
        direction:
          section === "Kudari" ||
          section === "Nobori"
            ? section
            : "",
        typeIndex: null,
        trainNo: "",
        unyo: "",
        timeRaw: "",
        rawTimes: [],
        stations: [],
        operations: {},
        operationLines: [],
        operationRemarks: [],
        nextTrainNo: "",
        previousTrainNo: "",
        operationSequence: null,
        operationLength: null,
        operationTurnback: null
      }

      if (
        section === "Kudari"
      ) {
        result.trains.Kudari.push(
          currentTrain
        )
      } else if (
        section === "Nobori"
      ) {
        result.trains.Nobori.push(
          currentTrain
        )
      }

      continue
    }

    const equalIndex =
      line.indexOf("=")

    if (equalIndex === -1) {
      continue
    }

    const key =
      line.slice(
        0,
        equalIndex
      ).trim()

    const value =
      line.slice(
        equalIndex + 1
      ).trim()

    if (key === "FileType") {
      result.fileType = value
      continue
    }

    if (key === "Rosenmei") {
      result.railwayName = value
      continue
    }

    if (
      key ===
      "KudariDiaAlias"
    ) {
      result.downAlias = value
      continue
    }

    if (
      key ===
      "NoboriDiaAlias"
    ) {
      result.upAlias = value
      continue
    }

    if (
      section === "Eki" &&
      currentStation
    ) {
      switch (key) {
        case "Ekimei":
          currentStation.name = value
          break

        case "EkimeiJikokuRyaku":
          currentStation.timeName =
            value
          break

        case "EkimeiDiaRyaku":
          currentStation.diagramName =
            value
          break

        case "Ekijikokukeisiki":
          currentStation.timeFormat =
            value
          break

        case "Ekikibo":
          currentStation.scale = value
          break

        case "DownMain":
          currentStation.downMain =
            value
          break

        case "UpMain":
          currentStation.upMain =
            value
          break

        case "TrackRyakusyou":
          currentStation.tracks.push(
            value
          )
          break
      }

      continue
    }

    if (
      section ===
        "Ressyasyubetsu" &&
      currentTrainType
    ) {
      if (
        key ===
        "Syubetsumei"
      ) {
        currentTrainType.name =
          value
      } else if (
        key ===
        "Ryakusyou"
      ) {
        currentTrainType.abbreviation =
          value
      } else if (
        key ===
        "JikokuhyouMojiColor"
      ) {
        currentTrainType.color =
          colorValueToCss(value)
      } else if (
        key ===
        "JikokuhyouBackColor"
      ) {
        currentTrainType.backgroundColor =
          colorValueToCss(value)
      } else if (
        key ===
        "JikokuhyouFontIndex"
      ) {
        currentTrainType.fontIndex =
          value
      }

      continue
    }

    if (
      section === "Dia" &&
      currentDiagram
    ) {
      if (
        key === "DiaName"
      ) {
        currentDiagram.name =
          value
      }

      continue
    }

    if (!currentTrain) {
      continue
    }

    if (
      /^Operation\d+[AB]$/.test(
        key
      )
    ) {
      parseOperationLine(
        currentTrain,
        line
      )

      continue
    }

    if (
      key === "Unyo" ||
      key === "UnYo"
    ) {
      if (!currentTrain.unyo) {
        currentTrain.unyo =
          value.trim()
      }

      continue
    }

    if (key === "Houkou") {
      currentTrain.direction =
        value

      continue
    }

    if (key === "Syubetsu") {
      const typeIndex =
        Number(value)

      currentTrain.typeIndex =
        Number.isNaN(typeIndex)
          ? null
          : typeIndex

      continue
    }

    if (
      key ===
      "Ressyabangou"
    ) {
      currentTrain.trainNo =
        value

      continue
    }

    if (
      key === "EkiJikoku"
    ) {
      const ekiJikoku =
        parseEkiJikoku(
          value
        )

      currentTrain.timeRaw =
        value

      currentTrain.rawTimes =
        ekiJikoku

      currentTrain.stations =
        createStationTimes(
          result.stations,
          ekiJikoku,
          currentTrain.direction,
          currentTrain.operationRemarks
        )

      continue
    }
  }

  for (
    const direction of [
      "Kudari",
      "Nobori"
    ]
  ) {
    for (
      const train of
      result.trains[direction]
    ) {
      const type =
        result.trainTypes[
          train.typeIndex
        ] || null

      train.type =
        type?.name || ""

      train.typeShort =
        type?.abbreviation || ""

      train.trainTypeColor =
        type?.color || "#000000"

      train.trainTypeBackgroundColor =
        type?.backgroundColor || "#ffffff"

      const first =
        getFirstStation(train)

      const last =
        getLastStation(train)

      train.origin =
        first?.name || ""

      train.destination =
        last?.name || ""
    }
  }

  const allTrains = [
    ...result.trains.Kudari,
    ...result.trains.Nobori
  ]

  clearTrainLinks(
    allTrains
  )

  const sortedTrains =
    [...allTrains].sort(
      (a, b) => {
        const aFirst =
          getFirstStation(a)

        const bFirst =
          getFirstStation(b)

        const aTime =
          timeToSeconds(
            aFirst?.departure ||
            aFirst?.arrival ||
            aFirst?.single
          )

        const bTime =
          timeToSeconds(
            bFirst?.departure ||
            bFirst?.arrival ||
            bFirst?.single
          )

        return aTime - bTime
      }
    )

  linkTrainsByOperation(
    sortedTrains
  )

  linkPhysicalTrains(
    sortedTrains
  )

  assignOperations(
    sortedTrains
  )

  addAutoRemarksToTrains(
    allTrains
  )

  for (
    const train of allTrains
  ) {
    cleanTrainForFirebase(
      train
    )
  }

  result.trainCount =
    allTrains.length

  result.stationCount =
    result.stations.length

  result.trainTypeCount =
    result.trainTypes.length

  result.diagramCount =
    result.diagrams.length

  return result
}

export default parseOud2
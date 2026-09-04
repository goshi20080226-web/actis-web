/*
 * ACTIS OUD2 Parser
 *
 * OUD2
 *  ↓
 * 駅
 * 列車
 * 時刻
 * 番線
 * stopType
 * Operation
 *  ↓
 * ACTIS用JSON
 */


// ========================================
// 共通
// ========================================

function normalizeTime(time) {

  if (!time) {
    return ""
  }

  return String(time).trim()
}


// ========================================
// Operation時刻
// ========================================

function normalizeOperationTime(raw) {

  if (!raw) {
    return ""
  }

  const value =
    String(raw)
      .replace(/[^0-9]/g, "")


  if (value.length < 3) {
    return ""
  }


  if (value.length <= 4) {

    const hour =
      value.slice(0, -2) || "0"

    const minute =
      value.slice(-2)

    return `${hour}:${minute}`
  }


  const hour =
    value.slice(0, -4) || "0"

  const minute =
    value.slice(-4, -2)

  const second =
    value.slice(-2)


  if (second === "00") {

    return `${hour}:${minute}`

  }


  return `${hour}:${minute}:${second}`
}


// ========================================
// Operation番線キー
// ========================================

function extractOperationTrackKey(value) {

  const text =
    String(value || "")


  const firstToken =
    text.split(",")[0] || text


  /*
   * 例:
   * 0/1
   * 9/2
   */

  let match =
    firstToken.match(
      /^\s*\d+\/(\d+)/
    )


  if (match) {
    return match[1]
  }


  /*
   * 例:
   * $/1
   */

  match =
    firstToken.match(
      /\$\/(\d+)/
    )


  if (match) {
    return match[1]
  }


  return ""
}


// ========================================
// Operation解析
// ========================================

function parseOperationNotes(
  rawValue,
  side
) {

  const notes = []


  if (!rawValue) {
    return notes
  }


  String(rawValue)
    .split(",")
    .forEach((token) => {

      const value =
        token.trim()


      if (!value) {
        return
      }


      const parts =
        value.split("$")


      const head =
        (parts[0] || "").trim()


      const trackKey =
        extractOperationTrackKey(value)


      /*
       * 5/$0
       *
       * 時刻なしなので
       * 特記事項には表示しない
       */

      if (
        /^5\s*\/\s*\$?0\s*$/.test(value) ||
        /^5\s*\/\s*$/.test(head)
      ) {

        return

      }


      /*
       * 3/時刻
       *
       * B → 出庫
       * A → 入区
       */

      const depotMatch =
        head.match(
          /^3\/(\d{3,6})/
        )


      if (depotMatch) {

        notes.push({

          label:
            side === "A"
              ? "入区"
              : "出庫",

          time:
            depotMatch[1],

          side,

          trackKey: ""

        })


        return
      }


      /*
       * 入換発
       *
       * $の後ろに
       * 時刻/時刻
       */

      let time = ""


      for (
        let i = 1;
        i < parts.length;
        i++
      ) {

        const match =
          String(parts[i] || "")
            .match(
              /(\d{3,6})\/(\d{0,6})/
            )


        if (match) {

          time =
            match[1]

          break

        }

      }


      /*
       * 別形式
       */

      if (!time) {

        const match =
          value.match(
            /\$(\d{3,6})\//
          )


        if (match) {

          time =
            match[1]

        }

      }


      if (time) {

        notes.push({

          label:
            "入換発",

          time,

          side,

          trackKey

        })

      }

    })


  /*
   * 重複削除
   */

  const seen =
    new Set()


  return notes.filter(
    (note) => {

      const key =
        `${note.label}|${note.time}|${note.trackKey}`


      if (seen.has(key)) {
        return false
      }


      seen.add(key)

      return true

    }
  )
}


// ========================================
// Operation○○A/B
// ========================================

function parseOperationLine(
  train,
  line
) {

  if (!train || !line) {
    return
  }


  const match =
    String(line).match(
      /^Operation(\d+)([AB])=(.*)$/
    )


  if (!match) {
    return
  }


  const rawIndex =
    parseInt(
      match[1],
      10
    )


  const side =
    match[2]


  const value =
    match[3] || ""


  /*
   * Operationそのものを保存
   */

  if (
    !Array.isArray(
      train.operationLines
    )
  ) {

    train.operationLines = []

  }


  const notes =
    parseOperationNotes(
      value,
      side
    )


  train.operationLines.push({

    rawIndex,

    side,

    value,

    notes

  })


  /*
   * スタフ特記事項用
   */

  if (
    !Array.isArray(
      train.operationRemarks
    )
  ) {

    train.operationRemarks = []

  }


  notes.forEach(
    (note) => {

      train.operationRemarks.push({

        rawIndex,

        side,

        label:
          note.label,

        time:
          normalizeOperationTime(
            note.time
          ),

        trackKey:
          note.trackKey || ""

      })

    }
  )


  /*
   * 運用番号
   *
   * $/A01
   * $/101
   * など
   */

  const operationMatch =
    value.match(
      /\$\/([^,]+)/
    )


  if (
    operationMatch &&
    operationMatch[1]
  ) {

    const operation =
      operationMatch[1].trim()


    if (!train.unyo) {

      train.unyo =
        operation

    }

  }
}


// ========================================
// EkiJikoku
// ========================================

function parseEkiJikoku(text) {

  if (!text) {
    return []
  }


  return String(text)
    .split(",")
    .map((value) => {

      if (!value) {

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


      let temp =
        value.trim()


      /*
       * $
       */

      const dollarParts =
        temp.split("$")


      let trackIdx = ""


      if (
        dollarParts.length > 1
      ) {

        temp =
          dollarParts[0]

        trackIdx =
          dollarParts[1] || ""

      }


      /*
       * ;
       */

      let stopType =
        "1"

      let arrival =
        ""

      let departure =
        ""

      let single =
        ""


      const semicolon =
        temp.indexOf(";")


      if (
        semicolon !== -1
      ) {

        stopType =
          temp.slice(
            0,
            semicolon
          )


        const time =
          temp.slice(
            semicolon + 1
          )


        /*
         * 着/発
         */

        if (
          time.includes("/")
        ) {

          const parts =
            time.split("/")


          arrival =
            normalizeTime(
              parts[0]
            )


          departure =
            normalizeTime(
              parts[1]
            )

        }

        /*
         * 片側時刻
         */

        else {

          single =
            normalizeTime(
              time
            )

        }

      } else {

        stopType =
          temp

      }


      return {

        arrival,

        departure,

        single,

        trackIdx,

        isPass:
          stopType === "2",

        stopType,

        typeChangeRef:
          null

      }

    })
}


// ========================================
// 駅の番線
// ========================================

function getTrackDisplay(
  station,
  trackIdx
) {
  if (
    trackIdx === "" ||
    trackIdx === null ||
    trackIdx === undefined
  ) {
    return ""
  }

  const tracks = Array.isArray(station?.tracks)
    ? station.tracks
    : []

  if (!tracks.length) {
    return ""
  }

  const raw = String(trackIdx).trim()
  if (!raw) return ""

  /*
   * EkiJikoku の $値は、この駅自身が持つ
   * TrackRyakusyou の並びを参照して解決する。
   *
   * TrackRyakusyou の内容や件数はOUD2データごと・駅ごとに
   * 異なるため、固定の番線一覧や「3以上なら○」のような
   * 決め打ちはしない。
   */
  const numeric = /^-?\d+$/.test(raw)
    ? Number(raw)
    : NaN

  if (Number.isInteger(numeric)) {
    // OUD2のtrack indexを、現在の駅の配列に対して解決。
    if (
      numeric >= 0 &&
      numeric < tracks.length &&
      tracks[numeric] !== undefined &&
      String(tracks[numeric]).trim() !== ""
    ) {
      return String(tracks[numeric]).trim()
    }

    // データ互換: そのデータで1始まりの指定になっている場合。
    const oneBased = numeric - 1
    if (
      oneBased >= 0 &&
      oneBased < tracks.length &&
      tracks[oneBased] !== undefined &&
      String(tracks[oneBased]).trim() !== ""
    ) {
      return String(tracks[oneBased]).trim()
    }
  }

  // すでにTrackRyakusyouの文字列が渡されている場合。
  const exact = tracks.find(
    (value) => String(value ?? "").trim() === raw
  )

  return exact !== undefined
    ? String(exact).trim()
    : ""
}


// ========================================
// 駅時刻作成
// ========================================

function createStationTimes(
  stations,
  ekiJikoku,
  direction,
  operationRemarks = []
) {

  const result = []


  const count =
    Math.min(
      stations.length,
      ekiJikoku.length
    )


  for (
    let i = 0;
    i < count;
    i++
  ) {

    const raw =
      ekiJikoku[i] || {}


    /*
     * 上りは駅順を反転
     */

    const stationIndex =
      direction === "Nobori"
        ? stations.length - 1 - i
        : i


    const station =
      stations[stationIndex]


    if (!station) {
      continue
    }


    /*
     * Operation特記事項
     */

    const stationOperationRemarks =
      operationRemarks.filter(
        (remark) =>
          Number(
            remark.rawIndex
          ) === i
      )


    result.push({
      rawIndex: i,
      name:
        station.name || "",

      shortName:
        station.timeName || "",

      diagramName:
        station.diagramName || "",

      trackIdx:
        raw.trackIdx || "",

      track:
        getTrackDisplay(
          station,
          raw.trackIdx
        ),

      // スタフ表示では必ず OUD2 の TrackRyakusyou を参照できるよう保持
      tracks:
        Array.isArray(station.tracks) ? [...station.tracks] : [],

      arrival:
        raw.arrival || "",

      departure:
        raw.departure || "",

      single:
        raw.single || "",

      isPass:
        raw.isPass === true,

      stopType:
        raw.stopType ?? "1",

      typeChangeRef:
        raw.typeChangeRef,

      remarks:
        "",

      operationRemarks:
        stationOperationRemarks

    })

  }


  /*
   * 実際の運転区間
   */

  let start = -1
  let end = -1


  result.forEach(
    (station, index) => {

      if (
        station.stopType === "0" ||
        station.stopType === "3"
      ) {

        return

      }


      if (start === -1) {

        start =
          index

      }


      end =
        index

    }
  )


  if (
    start === -1 ||
    end === -1
  ) {

    return []

  }


  const display = []


  for (
    let i = start;
    i <= end;
    i++
  ) {

    const station =
      result[i]


    if (!station) {
      continue
    }


    /*
     * 実際には運転しない区間を除外
     */

    if (
      station.stopType === "0" ||
      station.stopType === "3"
    ) {

      continue

    }


    let arrival =
      station.arrival


    let departure =
      station.departure


    /*
     * single
     *
     * 途中 → 発
     * 終着 → 着
     */

    if (
      station.single !== ""
    ) {

      if (i === end) {

        arrival =
          station.single

      } else {

        departure =
          station.single

      }

    }


    /*
     * 始発
     */

    if (i === start) {

      arrival = ""

    }


    /*
     * 終着
     */

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

// ========================================
// 運用解析
// ========================================

function timeToSec(time) {

  if (
    time === undefined ||
    time === null ||
    String(time).trim() === ""
  ) {
    return -1
  }

  const value =
    String(time)
      .replace(/[^0-9]/g, "")

  if (!value) {
    return -1
  }

  let hour
  let minute
  let second = 0

  if (value.length <= 4) {

    hour =
      parseInt(
        value.slice(0, -2) || "0",
        10
      )

    minute =
      parseInt(
        value.slice(-2),
        10
      )

  } else {

    hour =
      parseInt(
        value.slice(0, -4) || "0",
        10
      )

    minute =
      parseInt(
        value.slice(-4, -2),
        10
      )

    second =
      parseInt(
        value.slice(-2),
        10
      )

  }

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute)
  ) {
    return -1
  }

  return (
    hour * 3600 +
    minute * 60 +
    second
  )
}


function normalizeStation(
  name
) {

  return String(
    name || ""
  )
    .replace(/\s+/g, "")
    .trim()

}


// ========================================
// Operationを実際の駅へ対応させる
// ========================================

function resolveOperationStation(
  train,
  operation
) {

  if (
    !train ||
    !Array.isArray(
      train.stations
    ) ||
    !operation
  ) {
    return null
  }


  const row =
    train.stations.find(
      (station) =>
        Number(
          station.rawIndex
        ) ===
        Number(
          operation.rawIndex
        )
    )


  if (row) {
    return row
  }


  /*
   * 営業区間外のOperation
   *
   * B = 始発駅
   * A = 終着駅
   */

  if (
    operation.side === "B"
  ) {

    return (
      train.stations[0] ||
      null
    )

  }


  return (
    train.stations[
      train.stations.length - 1
    ] ||
    null
  )

}


// ========================================
// Operationの入出庫イベント
// ========================================

function buildOperationEvents(
  train
) {

  if (
    !train ||
    !Array.isArray(
      train.operationLines
    ) ||
    train.operationLines.length === 0
  ) {
    return []
  }


  const events = []


  train.operationLines.forEach(
    (operation) => {

      const station =
        resolveOperationStation(
          train,
          operation
        )


      if (!station) {
        return
      }


      const notes =
        Array.isArray(
          operation.notes
        )
          ? operation.notes
          : []


      /*
       * 時刻のあるOperationだけを
       * 入出庫・入換リンクに使用。
       *
       * 5/$0 はここでは使わない。
       */

      const note =
        notes.find(
          (item) =>
            item &&
            item.time
        )


      if (!note) {
        return
      }


      const sec =
        timeToSec(
          note.time
        )


      if (sec < 0) {
        return
      }


      /*
       * B = 出庫側
       * A = 入区側
       */

      const role =
        operation.side === "B"
          ? "out"
          : "in"


      events.push({

        role,

        side:
          operation.side,

        station:
          station.name || "",

        rawIndex:
          operation.rawIndex,

        time:
          note.time,

        sec,

        trackKey:
          note.trackKey || "",

        train

      })

    }
  )


  return events

}


// ========================================
// Operation側が実際の入出庫を持つか
// ========================================

function hasOperationSide(
  train,
  side
) {

  if (
    !train ||
    !Array.isArray(
      train.operationLines
    )
  ) {
    return false
  }


  /*
   * 5/$0 のような
   * 「時刻なし」は除外
   */

  return train.operationLines.some(
    (operation) => {

      if (
        !operation ||
        operation.side !== side
      ) {
        return false
      }


      const notes =
        Array.isArray(
          operation.notes
        )
          ? operation.notes
          : []


      return notes.some(
        (note) =>
          note &&
          note.time
      )

    }
  )

}


// ========================================
// Operationによる運用接続
// ========================================

function linkTrainsByOperation(
  sortedTrains
) {
  const inEvents = []
  const outEvents = []
  sortedTrains.forEach((train) => {
    train.operationTurnback = null
    buildOperationEvents(train).forEach((event) => {
      if (event.role === "in") inEvents.push(event)
      if (event.role === "out") outEvents.push(event)
    })
  })
  inEvents.sort((a, b) => a.sec - b.sec)
  outEvents.sort((a, b) => a.sec - b.sec)
  inEvents.forEach((inEvent) => {
    const current = inEvent.train
    if (!current || current.nextTrainNo) return
    let best = null
    let bestDiff = Infinity
    outEvents.forEach((outEvent) => {
      const candidate = outEvent.train
      if (!candidate || candidate === current) return
      if (candidate.previousTrainNo) return
      if (normalizeStation(inEvent.station) !== normalizeStation(outEvent.station)) return
      if (outEvent.sec < inEvent.sec) return
      if (inEvent.trackKey && outEvent.trackKey && String(inEvent.trackKey) !== String(outEvent.trackKey)) return
      const diff = outEvent.sec - inEvent.sec
      if (diff < bestDiff) { bestDiff = diff; best = outEvent }
    })
    if (!best) return
    const next = best.train
    current.nextTrainNo = next.trainNo || ""
    next.previousTrainNo = current.trainNo || ""
    current.operationTurnback = {
      station: inEvent.station,
      inTime: inEvent.time,
      outTime: best.time,
      trackKey: inEvent.trackKey || best.trackKey || ""
    }
  })
}


function linkPhysicalTrains(
  sortedTrains
) {
  const linkedAsNext = new Set()
  sortedTrains.forEach((train) => {
    if (train.nextTrainNo) linkedAsNext.add(String(train.nextTrainNo))
  })
  sortedTrains.forEach((train) => {
    if (train.nextTrainNo) return
    if (hasOperationSide(train, "A")) return
    if (!Array.isArray(train.stations) || train.stations.length === 0) return
    const last = train.stations[train.stations.length - 1]
    const endTime = timeToSec(last.arrival || last.departure || last.single)
    if (endTime < 0) return
    let best = null; let bestDiff = Infinity
    sortedTrains.forEach((candidate) => {
      if (candidate === train) return
      if (candidate.trainNo && linkedAsNext.has(String(candidate.trainNo))) return
      if (hasOperationSide(candidate, "B")) return
      if (candidate.previousTrainNo) return
      if (!Array.isArray(candidate.stations) || candidate.stations.length === 0) return
      const first = candidate.stations[0]
      const startTime = timeToSec(first.departure || first.arrival || first.single)
      if (startTime < 0) return
      if (normalizeStation(last.name) !== normalizeStation(first.name)) return
      if (last.track && first.track && String(last.track) !== String(first.track)) return
      if (startTime < endTime) return
      const diff = startTime - endTime
      if (diff < bestDiff) { bestDiff = diff; best = candidate }
    })
    if (best) {
      train.nextTrainNo = best.trainNo || ""
      best.previousTrainNo = train.trainNo || ""
      linkedAsNext.add(String(best.trainNo || ""))
    }
  })
}


function assignOperations(
  trains
) {
  const trainMap = new Map()
  trains.forEach((train) => { if (train.trainNo) trainMap.set(String(train.trainNo), train) })
  const groups = []; const visited = new Set()
  trains.forEach((train) => {
    if (visited.has(train) || train.previousTrainNo) return
    const group = []; let current = train
    while (current && !visited.has(current)) {
      group.push(current); visited.add(current)
      current = current.nextTrainNo ? trainMap.get(String(current.nextTrainNo)) : null
    }
    if (group.length) groups.push(group)
  })
  trains.forEach((train) => { if (!visited.has(train)) { groups.push([train]); visited.add(train) } })
  groups.forEach((group) => {
    let knownUnyo = ""
    for (const train of group) {
      if (train.unyo && String(train.unyo).trim() !== "") { knownUnyo = String(train.unyo).trim(); break }
    }
    if (!knownUnyo) return
    group.forEach((train,index) => {
      if (!train.unyo || String(train.unyo).trim() === "") train.unyo = knownUnyo
      train.operationSequence = index + 1
      train.operationLength = group.length
    })
  })
  return groups
}


function analyzeOperations(
  trains
) {
  trains.forEach((train) => {
    train.nextTrainNo = ""
    train.previousTrainNo = ""
    train.operationSequence = null
    train.operationLength = null
    train.operationTurnback = null
  })
  const sortedTrains = [...trains].sort((a,b) => {
    const aFirst = a.stations?.[0]; const bFirst = b.stations?.[0]
    return timeToSec(aFirst?.departure || aFirst?.arrival || aFirst?.single) - timeToSec(bFirst?.departure || bFirst?.arrival || bFirst?.single)
  })
  linkTrainsByOperation(sortedTrains)
  linkPhysicalTrains(sortedTrains)
  const groups = assignOperations(sortedTrains)
  console.log("===== 運用解析結果 =====")
  groups.forEach((group) => console.log(group.map((train) => ({ trainNo: train.trainNo, unyo: train.unyo || "", sequence: train.operationSequence, next: train.nextTrainNo || "", previous: train.previousTrainNo || "", turnback: train.operationTurnback || null }))))
  console.log("=======================")
  return groups
}


function timeToSeconds(time) {

  if (!time) {
    return -1
  }

  const value =
    String(time)
      .replace(/[^0-9]/g, "")

  if (!value) {
    return -1
  }

  let hour = 0
  let minute = 0
  let second = 0

  if (value.length <= 4) {

    hour =
      Number(
        value.slice(0, -2)
      )

    minute =
      Number(
        value.slice(-2)
      )

  } else {

    hour =
      Number(
        value.slice(0, -4)
      )

    minute =
      Number(
        value.slice(-4, -2)
      )

    second =
      Number(
        value.slice(-2)
      )

  }

  return (
    hour * 3600 +
    minute * 60 +
    second
  )
}


function normalizeStationName(
  name
) {

  return String(
    name || ""
  )
    .replace(/\s+/g, "")
    .trim()

}


function getFirstStation(train) {

  if (
    !Array.isArray(
      train.stations
    )
  ) {
    return null
  }

  return (
    train.stations[0] ||
    null
  )

}


function getLastStation(train) {

  if (
    !Array.isArray(
      train.stations
    )
  ) {
    return null
  }

  return (
    train.stations[
      train.stations.length - 1
    ] ||
    null
  )

}


// ========================================
// 運用リンク
function parseOud2(
  text,
  fileName = ""
) {

  const lines =
    String(text)
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

  // EkiTrack2 は駅内の入れ子。各 TrackRyakusyou の末尾の "." では駅を終了しない。
  let inEkiTrack2 = false

  let currentStation =
    null

  let currentTrainType =
    null

  let currentDiagram =
    null

  let currentTrain =
    null


  for (
    const rawLine of lines
  ) {

    const line =
      rawLine.trim()


    if (!line) {
      continue
    }


    /*
     * セクション終了
     */

    if (line === ".") {

      if (inEkiTrack2) {
        inEkiTrack2 = false
        continue
      }

      currentStation = null
      currentTrainType = null
      currentDiagram = null
      currentTrain = null

      continue
    }


    /*
     * 駅
     */

    if (line === "EkiTrack2." && currentStation) {
      inEkiTrack2 = true
      continue
    }

    if (line === "Eki.") {
      inEkiTrack2 = false

      section =
        "Eki"


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


    /*
     * 列車種別
     */

    if (
      line ===
      "Ressyasyubetsu."
    ) {

      section =
        "Ressyasyubetsu"


      currentTrainType = {

        name: "",

        abbreviation: "",

        trainTypeColor: "",

        index:
          result.trainTypes.length

      }


      result.trainTypes.push(
        currentTrainType
      )


      continue
    }


    /*
     * ダイヤ
     */

    if (line === "Dia.") {

      section =
        "Dia"


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


    /*
     * 下り
     */

    if (line === "Kudari.") {

      section =
        "Kudari"

      continue
    }


    /*
     * 上り
     */

    if (line === "Nobori.") {

      section =
        "Nobori"

      continue
    }


    /*
     * 列車
     */

    if (line === "Ressya.") {

      currentTrain = {

        direction:
          section,

        typeIndex:
          null,

        trainNo:
          "",

        unyo:
          "",

        timeRaw:
          "",

        stations:
          [],

        operations:
          {},

        operationLines:
          [],

        operationRemarks:
          []

      }


      if (
        section === "Kudari"
      ) {

        result.trains.Kudari.push(
          currentTrain
        )

      }


      if (
        section === "Nobori"
      ) {

        result.trains.Nobori.push(
          currentTrain
        )

      }


      continue
    }


    /*
     * key=value
     */

    const equalIndex =
      line.indexOf("=")


    if (
      equalIndex === -1
    ) {

      continue

    }


    const key =
      line.slice(
        0,
        equalIndex
      )


    const value =
      line.slice(
        equalIndex + 1
      )


    /*
     * ファイル情報
     */

    if (
      key === "FileType"
    ) {

      result.fileType =
        value

      continue
    }


    /*
     * 路線名
     */

    if (
      key === "Rosenmei"
    ) {

      result.railwayName =
        value

      continue
    }


    /*
     * ダイヤ別名
     */

    if (
      key === "KudariDiaAlias"
    ) {

      result.downAlias =
        value

      continue
    }


    if (
      key === "NoboriDiaAlias"
    ) {

      result.upAlias =
        value

      continue
    }


    /*
     * 駅
     */

    if (
      section === "Eki" &&
      currentStation
    ) {

      if (
        key === "Ekimei"
      ) {

        currentStation.name =
          value

      }

      else if (
        key ===
        "EkimeiJikokuRyaku"
      ) {

        currentStation.timeName =
          value

      }

      else if (
        key ===
        "EkimeiDiaRyaku"
      ) {

        currentStation.diagramName =
          value

      }

      else if (
        key ===
        "Ekijikokukeisiki"
      ) {

        currentStation.timeFormat =
          value

      }

      else if (
        key === "Ekikibo"
      ) {

        currentStation.scale =
          value

      }

      else if (
        key === "DownMain"
      ) {

        currentStation.downMain =
          value

      }

      else if (
        key === "UpMain"
      ) {

        currentStation.upMain =
          value

      }

      else if (
        key ===
        "TrackRyakusyou"
      ) {

        currentStation.tracks.push(
          value
        )

      }


      continue
    }


    /*
     * 列車種別
     */

    if (
      section ===
        "Ressyasyubetsu" &&
      currentTrainType
    ) {

      if (
        key === "Syubetsumei"
      ) {

        currentTrainType.name =
          value

      }

      else if (
        key === "Ryakusyou"
      ) {

        currentTrainType.abbreviation =
          value

      }

      else if (
        key === "JikokuhyouMojiColor"
      ) {

        /*
         * OUD2の種別文字色は8桁のBGR順。
         * 00BBGGRR → CSSの #RRGGBB に変換する。
         */
        const color =
          String(
            value || ""
          ).trim()

        if (
          /^[0-9A-Fa-f]{8}$/.test(color)
        ) {

          currentTrainType.trainTypeColor =
            "#" +
            color.slice(6, 8) +
            color.slice(4, 6) +
            color.slice(2, 4)

        }

        else if (
          /^[0-9A-Fa-f]{6}$/.test(color)
        ) {

          /* 旧形式との互換 */
          currentTrainType.trainTypeColor =
            "#" +
            color

        }

      }


      continue
    }


    /*
     * ダイヤ
     */

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


    /*
     * 列車
     */

    if (currentTrain) {

      /*
       * Operation
       */

      if (
        key.startsWith(
          "Operation"
        )
      ) {

        parseOperationLine(
          currentTrain,
          line
        )

        continue
      }


      /*
       * 運用番号
       */

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


      /*
       * 方向
       */

      if (
        key === "Houkou"
      ) {

        currentTrain.direction =
          value

        continue
      }


      /*
       * 種別
       */

      if (
        key === "Syubetsu"
      ) {

        currentTrain.typeIndex =
          Number(value)

        continue
      }


      /*
       * 列車番号
       */

      if (
        key === "Ressyabangou"
      ) {

        currentTrain.trainNo =
          value

        continue
      }


      /*
       * 駅時刻
       */

      if (
        key === "EkiJikoku"
      ) {

        currentTrain.timeRaw =
          value


        const ekiJikoku =
          parseEkiJikoku(
            value
          )


        currentTrain.rawTimes =
          ekiJikoku


        currentTrain.stations =
          createStationTimes(
            result.stations,
            ekiJikoku,
            section,
            currentTrain.operationRemarks
          )


        continue
      }


      /*
       * その他Operation
       */

      if (
        key.startsWith(
          "Operation"
        )
      ) {

        currentTrain.operations[key] =
          value

        continue
      }

    }

  }


  /*
   * ====================================
   * 列車種別を付与
   * ====================================
   */

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
        type?.JikokuhyouMojiColor ||
        type?.jikokuhyouMojiColor ||
        type?.trainTypeColor ||
        ""


      /*
       * 行先
       */

      if (
        train.stations &&
        train.stations.length > 0
      ) {

        train.destination =
          train.stations[
            train.stations.length - 1
          ].name

      }

    }

  }


  // ========================================
// 運用解析
// ========================================
const allTrains = [
    ...result.trains.Kudari,
    ...result.trains.Nobori
  ]

  analyzeOperations(allTrains)

  return result
}


export default parseOud2
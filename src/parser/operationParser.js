/*
 * ACTIS Operation Parser
 *
 * 元ACTISの運用解析方式をReact版へ移植
 *
 * 重要:
 * 列車の駅データ       -> displayRows
 * Operationデータ      -> _operationLines
 *
 * CSV不要
 */


// ========================================
// 共通
// ========================================

function normalizeStr(value) {

  return String(value ?? "")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
      String.fromCharCode(
        s.charCodeAt(0) - 0xFEE0
      )
    )
    .replace(/\s+/g, "")
    .trim()

}


// ========================================
// 時刻
// ========================================

function timeToSec(value) {

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {

    return -1

  }


  const text =
    String(value)
      .replace(/[^0-9]/g, "")


  if (!text) {
    return -1
  }


  let hour
  let minute
  let second


  if (text.length <= 4) {

    hour =
      Number(
        text.slice(0, -2)
      )

    minute =
      Number(
        text.slice(-2)
      )

    second = 0

  }

  else {

    hour =
      Number(
        text.slice(0, -4)
      )

    minute =
      Number(
        text.slice(-4, -2)
      )

    second =
      Number(
        text.slice(-2)
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


// ========================================
// Operation番線
// ========================================

function extractOperationTrackKey(
  value
) {

  const text =
    String(value || "")


  const firstToken =
    text.split(",")[0] ||
    text


  let match =
    firstToken.match(
      /^\s*\d+\/(\d+)/
    )


  if (match) {

    return match[1]

  }


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
    .forEach(
      (token) => {

        const s =
          token.trim()


        if (!s) {
          return
        }


        const parts =
          s.split("$")


        const head =
          (
            parts[0] ||
            ""
          ).trim()


        const trackKey =
          extractOperationTrackKey(
            s
          )


        /*
         * 5/$0
         *
         * 時刻なし
         *
         * これは折返し時刻として
         * 使用しない
         */

        if (
          /^5\s*\/\s*\$?0\s*$/
            .test(s)
        ) {

          return

        }


        /*
         * 3/時刻
         *
         * B = 出庫
         * A = 入区
         */

        const outMatch =
          head.match(
            /^3\/(\d{3,6})/
          )


        if (outMatch) {

          notes.push({

            label:
              side === "A"
                ? "入区"
                : "出庫",

            time:
              outMatch[1],

            side,

            trackKey: ""

          })


          return

        }


        /*
         * 入換発
         */

        let timePair = null


        for (
          let i = 1;
          i < parts.length;
          i++
        ) {

          const match =
            String(
              parts[i] || ""
            ).match(
              /(\d{3,6})\/(\d{0,6})/
            )


          if (match) {

            timePair =
              match[1]

            break

          }

        }


        if (!timePair) {

          const match =
            s.match(
              /\$(\d{3,6})\//
            )


          if (match) {

            timePair =
              match[1]

          }

        }


        if (timePair) {

          notes.push({

            label:
              "入換発",

            time:
              timePair,

            side,

            trackKey

          })

        }

      }
    )


  /*
   * 重複削除
   */

  const seen =
    new Set()


  return notes.filter(
    (note) => {

      const key =
        [
          note.label,
          note.time,
          note.trackKey || ""
        ].join("|")


      if (
        seen.has(key)
      ) {

        return false

      }


      seen.add(key)

      return true

    }
  )

}


// ========================================
// Operation行を列車へ登録
// ========================================

export function parseOperationLines(
  operationLines = []
) {

  const result = []


  for (
    const line of operationLines
  ) {

    if (!line) {
      continue
    }


    /*
     * 既に解析済み
     */

    if (
      typeof line === "object"
    ) {

      const rawIndex =
        Number(
          line.rawIndex
        )


      const side =
        line.side ||
        ""


      const value =
        line.value ||
        ""


      const notes =
        Array.isArray(
          line.notes
        )

          ? line.notes

          : parseOperationNotes(
              value,
              side
            )


      result.push({

        rawIndex,

        side,

        value,

        notes

      })


      continue

    }


    /*
     * Operation29B=...
     */

    const match =
      String(line).match(
        /^Operation(\d+)([AB])=(.*)$/
      )


    if (!match) {
      continue
    }


    const rawIndex =
      Number(
        match[1]
      )


    const side =
      match[2]


    const value =
      match[3] || ""


    result.push({

      rawIndex,

      side,

      value,

      notes:
        parseOperationNotes(
          value,
          side
        )

    })

  }


  return result

}


// ========================================
// Operation行を列車へ適用
// ========================================

export function applyOperationRemarks(
  train
) {

  if (!train) {
    return train
  }


  /*
   * 元ACTIS準拠
   */

  if (
    !Array.isArray(
      train.displayRows
    )
  ) {

    return train

  }


  let operations =
    train._operationLines


  /*
   * Parserによって
   * operationLinesになっている場合にも対応
   */

  if (
    !Array.isArray(
      operations
    )
  ) {

    operations =
      parseOperationLines(
        train.operationLines || []
      )

  }


  train._operationLines =
    operations


  /*
   * 各Operationを
   * displayRowsへ反映
   */

  operations.forEach(
    (operation) => {

      let row =
        train.displayRows.find(
          (r) =>
            Number(
              r.rawIndex
            ) ===
            Number(
              operation.rawIndex
            )
        )


      /*
       * 営業範囲外
       *
       * B → 始発
       * A → 終着
       */

      if (!row) {

        row =
          operation.side === "B"

            ? train.displayRows[0]

            : train.displayRows[
                train.displayRows.length - 1
              ]

      }


      if (!row) {
        return
      }


      if (
        !Array.isArray(
          row.operationRemarks
        )
      ) {

        row.operationRemarks =
          []

      }


      operation.notes.forEach(
        (note) => {

          const exists =
            row.operationRemarks.some(
              (item) =>

                item.label ===
                  note.label &&

                item.time ===
                  note.time &&

                (
                  item.trackKey ||
                  ""
                ) ===
                  (
                    note.trackKey ||
                    ""
                  )
            )


          if (exists) {
            return
          }


          row.operationRemarks.push({

            label:
              note.label,

            time:
              note.time,

            side:
              note.side,

            trackKey:
              note.trackKey ||
              ""

          })

        }
      )

    }
  )


  return train

}


// ========================================
// Operation Side判定
// ========================================

function hasOperationSide(
  train,
  side
) {

  if (
    !train ||
    !Array.isArray(
      train._operationLines
    )
  ) {

    return false

  }


  return train._operationLines.some(
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


      /*
       * 時刻を持つOperationだけ有効
       */

      return notes.some(
        (note) =>
          note &&
          note.time
      )

    }
  )

}


// ========================================
// 最初の営業駅
// ========================================

function getFirstRow(
  train
) {

  if (
    !train ||
    !Array.isArray(
      train.displayRows
    )
  ) {

    return null

  }


  return (
    train.displayRows[0] ||
    null
  )

}


// ========================================
// 最後の営業駅
// ========================================

function getLastRow(
  train
) {

  if (
    !train ||
    !Array.isArray(
      train.displayRows
    )
  ) {

    return null

  }


  return (
    train.displayRows[
      train.displayRows.length - 1
    ] ||
    null
  )

}


// ========================================
// 運用折返しイベント
// ========================================

function buildOperationTurnbackEvents(
  train
) {

  if (
    !train ||
    !Array.isArray(
      train.displayRows
    )
  ) {

    return []

  }


  const lines =
    Array.isArray(
      train._operationLines
    )
      ? train._operationLines
      : []


  if (
    lines.length === 0
  ) {

    return []

  }


  const first =
    getFirstRow(
      train
    )


  const last =
    getLastRow(
      train
    )


  const fallbackOutTime =
    timeToSec(
      first &&
      (
        first.dep ||
        first.arr
      )
    )


  const fallbackInTime =
    timeToSec(
      last &&
      (
        last.arr ||
        last.dep
      )
    )


  const events = []


  lines.forEach(
    (operation) => {

      let row =
        train.displayRows.find(
          (r) =>
            Number(
              r.rawIndex
            ) ===
            Number(
              operation.rawIndex
            )
        )


      if (!row) {

        row =
          operation.side === "B"

            ? first

            : last

      }


      if (!row) {
        return
      }


      const notes =
        Array.isArray(
          operation.notes
        )
          ? operation.notes
          : []


      /*
       * 時刻のあるNoteを使用
       */

      const note =
        notes.find(
          (n) =>
            n &&
            n.time
        )


      if (!note) {

        /*
         * 5/$0などは
         * 時刻なしなので無視
         */

        return

      }


      let sec =
        timeToSec(
          note.time
        )


      if (
        sec < 0
      ) {

        sec =
          operation.side === "B"

            ? fallbackOutTime

            : fallbackInTime

      }


      if (
        sec < 0
      ) {

        return

      }


      events.push({

        role:
          operation.side === "B"
            ? "out"
            : "in",

        side:
          operation.side,

        station:
          row.name || "",

        rawIndex:
          operation.rawIndex,

        sec,

        time:
          note.time,

        label:
          note.label,

        trackKey:
          note.trackKey ||
          "",

        train

      })

    }
  )


  return events

}


// ========================================
// Operationによる折返し接続
// ========================================

function linkTrainsByOperationTurnbacks(
  sortedTrains
) {

  const inEvents = []
  const outEvents = []


  sortedTrains.forEach(
    (train) => {

      train._nextTrain =
        null

      train._isLinkedAsNext =
        false

      train._operationTurnbackLink =
        null


      const events =
        buildOperationTurnbackEvents(
          train
        )


      events.forEach(
        (event) => {

          if (
            event.role === "in"
          ) {

            inEvents.push(
              event
            )

          }

          else if (
            event.role === "out"
          ) {

            outEvents.push(
              event
            )

          }

        }
      )

    }
  )


  inEvents.sort(
    (a, b) =>
      a.sec - b.sec
  )


  outEvents.sort(
    (a, b) =>
      a.sec - b.sec
  )


  const usedOut =
    new Set()


  inEvents.forEach(
    (inEvent) => {

      const currentTrain =
        inEvent.train


      if (
        !currentTrain
      ) {

        return

      }


      /*
       * 既に接続済み
       */

      if (
        currentTrain._nextTrain
      ) {

        return

      }


      let best = null

      let bestDiff =
        Infinity


      outEvents.forEach(
        (outEvent) => {

          const nextTrain =
            outEvent.train


          if (
            !nextTrain ||
            nextTrain ===
              currentTrain
          ) {

            return

          }


          /*
           * 同じ列車を
           * 複数の運用に使用しない
           */

          if (
            usedOut.has(
              nextTrain
            )
          ) {

            return

          }


          /*
           * 同一駅
           */

          if (
            normalizeStr(
              inEvent.station
            ) !==
            normalizeStr(
              outEvent.station
            )
          ) {

            return

          }


          /*
           * 時刻順
           */

          if (
            outEvent.sec <
            inEvent.sec
          ) {

            return

          }


          /*
           * 番線が双方にある場合
           * 一致させる
           */

          if (
            inEvent.trackKey &&
            outEvent.trackKey &&
            String(
              inEvent.trackKey
            ) !==
            String(
              outEvent.trackKey
            )
          ) {

            return

          }


          const diff =
            outEvent.sec -
            inEvent.sec


          if (
            diff <
            bestDiff
          ) {

            bestDiff =
              diff

            best =
              outEvent

          }

        }
      )


      if (!best) {
        return
      }


      const nextTrain =
        best.train


      /*
       * 元ACTISと同じく
       * nextTrainを設定
       */

      currentTrain._nextTrain =
        nextTrain


      nextTrain._isLinkedAsNext =
        true


      nextTrain._previousTrain =
        currentTrain


      /*
       * React/Firebase側でも使える名前
       */

      currentTrain.nextTrain =
        nextTrain

      nextTrain.previousTrain =
        currentTrain


      currentTrain
        ._operationTurnbackLink = {

          station:
            inEvent.station,

          inTime:
            inEvent.time,

          outTime:
            best.time,

          trackKey:
            inEvent.trackKey ||
            best.trackKey ||
            ""

        }


      usedOut.add(
        nextTrain
      )

    }
  )

}


// ========================================
// 通常の物理折返し
//
// 元ACTISのロジックをそのまま移植
// ========================================

function linkPhysicalTurnbacks(
  sortedTrains
) {

  sortedTrains.forEach(
    (train) => {

      /*
       * Operationで接続済み
       */

      if (
        train._nextTrain
      ) {

        return

      }


      /*
       * 営業後に入区する列車は
       * ホーム折返しさせない
       */

      if (
        hasOperationSide(
          train,
          "A"
        )
      ) {

        return

      }


      const rows =
        train.displayRows


      if (
        !Array.isArray(rows) ||
        rows.length === 0
      ) {

        return

      }


      const last =
        rows[
          rows.length - 1
        ]


      const endTime =
        timeToSec(
          last.arr ||
          last.dep
        )


      if (
        endTime < 0
      ) {

        return

      }


      let best = null

      let min =
        Infinity


      sortedTrains.forEach(
        (candidate) => {

          /*
           * 自分自身
           */

          if (
            candidate === train
          ) {

            return

          }


          /*
           * 既に次列車として
           * 使用済み
           */

          if (
            candidate._isLinkedAsNext
          ) {

            return

          }


          /*
           * 出庫列車は
           * ホーム折返しに使わない
           */

          if (
            hasOperationSide(
              candidate,
              "B"
            )
          ) {

            return

          }


          const candidateRows =
            candidate.displayRows


          if (
            !Array.isArray(
              candidateRows
            ) ||
            candidateRows.length === 0
          ) {

            return

          }


          const first =
            candidateRows[0]


          const startTime =
            timeToSec(
              first.dep ||
              first.arr
            )


          if (
            startTime < 0
          ) {

            return

          }


          /*
           * 同じ駅
           */

          if (
            normalizeStr(
              first.name
            ) !==
            normalizeStr(
              last.name
            )
          ) {

            return

          }


          /*
           * 同じ番線
           */

          if (
            first.track &&
            last.track &&
            String(
              first.track
            ) !==
            String(
              last.track
            )
          ) {

            return

          }


          /*
           * 次列車は後
           */

          if (
            startTime <
            endTime
          ) {

            return

          }


          const diff =
            startTime -
            endTime


          if (
            diff < min
          ) {

            min =
              diff

            best =
              candidate

          }

        }
      )


      if (best) {

        train._nextTrain =
          best


        train.nextTrain =
          best


        best._previousTrain =
          train


        best.previousTrain =
          train


        best._isLinkedAsNext =
          true

      }

    }
  )

}


// ========================================
// 運用構築
// ========================================

export function buildOperations(
  trains
) {

  /*
   * ======================================
   * 初期化
   * ======================================
   */

  trains.forEach(
    (train) => {

      train._nextTrain =
        null

      train._previousTrain =
        null

      train._isLinkedAsNext =
        false

      train._operationTurnbackLink =
        null

      train.nextTrain =
        null

      train.previousTrain =
        null

      train.operationSequence =
        null

      train.operationLength =
        null

    }
  )


  /*
   * ======================================
   * 時刻順
   * ======================================
   */

  const sortedTrains =
    [...trains].sort(
      (a, b) => {

        const aRows =
          Array.isArray(
            a.displayRows
          )
            ? a.displayRows
            : []


        const bRows =
          Array.isArray(
            b.displayRows
          )
            ? b.displayRows
            : []


        const aTime =
          timeToSec(
            aRows[0]?.dep ||
            aRows[0]?.arr
          )


        const bTime =
          timeToSec(
            bRows[0]?.dep ||
            bRows[0]?.arr
          )


        return (
          aTime - bTime
        )

      }
    )


  /*
   * ======================================
   * ① Operation折返し
   * ======================================
   */

  linkTrainsByOperationTurnbacks(
    sortedTrains
  )


  /*
   * ======================================
   * ② 通常折返し
   * ======================================
   */

  linkPhysicalTurnbacks(
    sortedTrains
  )


  /*
   * ======================================
   * ③ グループ構築
   *
   * 「前列車がない列車」を
   * 各運用の先頭とする
   * ======================================
   */

  const groups = []

  const used =
    new Set()


  sortedTrains.forEach(
    (train) => {

      if (
        used.has(train)
      ) {

        return

      }


      /*
       * 前列車がある場合、
       * これは運用途中なので
       * 後で先頭から辿る
       */

      if (
        train._previousTrain
      ) {

        return

      }


      const group = []

      let current =
        train


      while (
        current &&
        !used.has(current)
      ) {

        group.push(
          current
        )

        used.add(
          current
        )


        current =
          current._nextTrain

      }


      if (
        group.length
      ) {

        groups.push(
          group
        )

      }

    }
  )


  /*
   * ======================================
   * ④ 孤立列車
   * ======================================
   */

  sortedTrains.forEach(
    (train) => {

      if (
        used.has(train)
      ) {

        return

      }


      groups.push([
        train
      ])

      used.add(
        train
      )

    }
  )


  /*
   * ======================================
   * ⑤ 運用番号継承
   *
   * ここが今回の重要部分
   *
   * 出庫列車
   *   A01
   *    ↓
   * 次列車
   *   未設定
   *    ↓
   * 次列車
   *   未設定
   *
   * ↓↓↓
   *
   * 全部A01
   * ======================================
   */

  let autoUnyoNo =
    1


  groups.forEach(
    (group) => {

      let assignedUnyo =
        ""


      /*
       * グループ内のどこかに
       * 既存運用番号があれば採用
       */

      for (
        const train of group
      ) {

        if (
          train.unyo !==
            undefined &&
          train.unyo !==
            null &&
          String(
            train.unyo
          ).trim() !== ""
        ) {

          assignedUnyo =
            String(
              train.unyo
            ).trim()

          break

        }

      }


      /*
       * 既存番号がない場合のみ
       * 自動採番
       */

      if (
        !assignedUnyo
      ) {

        assignedUnyo =
          `自動組番 ${autoUnyoNo}`

        autoUnyoNo++

      }


      /*
       * グループ全体に継承
       */

      group.forEach(
        (train, index) => {

          train.unyo =
            assignedUnyo


          train.operationSequence =
            index + 1


          train.operationLength =
            group.length

        }
      )

    }
  )


  /*
   * ======================================
   * デバッグ
   * ======================================
   */

  console.log(
    "===== ACTIS 運用解析 ====="
  )


  groups.forEach(
    (group) => {

      console.log(
        "運用:",
        group[0]?.unyo,
        "列車数:",
        group.length
      )


      console.log(
        group.map(
          (train) => ({
            trainNo:
              train.trainNo ||
              train.no,

            unyo:
              train.unyo,

            sequence:
              train.operationSequence,

            next:
              train._nextTrain?.trainNo ||
              train._nextTrain?.no ||
              null,

            previous:
              train._previousTrain?.trainNo ||
              train._previousTrain?.no ||
              null
          })
        )
      )

    }
  )


  console.log(
    "=========================="
  )


  return groups

}
console.table(
  trains.map(t => ({
    列番: t.no ?? t.trainNo,
    運用: t.unyo,
    次列車:
      t._nextTrain?.no ??
      t._nextTrain?.trainNo ??
      "なし",
    前列車:
      t._previousTrain?.no ??
      t._previousTrain?.trainNo ??
      "なし",
    Operation:
      t._operationLines?.map(
        x => `${x.side}:${x.value}`
      ).join(" / ") ?? ""
  }))
)

// ========================================
// Export
// ========================================

export {

  timeToSec,

  hasOperationSide,

  buildOperationTurnbackEvents,

  linkTrainsByOperationTurnbacks,

  linkPhysicalTurnbacks

}


export default {

  parseOperationLines,

  applyOperationRemarks,

  buildOperationTurnbackEvents,

  linkTrainsByOperationTurnbacks,

  linkPhysicalTurnbacks,

  buildOperations

}
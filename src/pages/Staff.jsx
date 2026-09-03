import {
  useEffect,
  useState
} from "react"

import {
  ref,
  get
} from "firebase/database"

import {
  onAuthStateChanged
} from "firebase/auth"

import {
  useParams,
  useSearchParams
} from "react-router-dom"

import {
  auth,
  database
} from "../firebase/config"

import StaffCard from "../components/staff/StaffCard"
import DatasetSelector from "../components/dataset/DatasetSelector"
import { useDataset } from "../context/DatasetContext"


function getCurrentUser() {

  return new Promise(
    resolve => {

      if (
        auth.currentUser
      ) {

        resolve(
          auth.currentUser
        )

        return

      }


      const unsubscribe =
        onAuthStateChanged(
          auth,
          user => {

            unsubscribe()

            resolve(
              user
            )

          }
        )

    }
  )

}


// ========================================
// Operation記事生成
// ========================================

function buildOperationText(
  remark
) {

  if (!remark) {
    return ""
  }


  if (
    typeof remark ===
    "string"
  ) {

    return remark.trim()

  }


  let label =
    String(
      remark.label ||
      ""
    ).trim()


  const time =
    String(
      remark.time ||
      ""
    ).trim()


  const track =
    String(
      remark.trackName ||
      remark.track ||
      remark.trackKey ||
      ""
    ).trim()


  if (
    label ===
    "入区"
  ) {

    label =
      "入庫"

  }


  const parts = []


  if (
    label
  ) {

    parts.push(
      label
    )

  }


  if (
    time
  ) {

    parts.push(
      time
    )

  }


  if (
    track
  ) {

    parts.push(
      track
    )

  }


  return parts.join(
    " "
  )

}


// ========================================
// Operationを始終端へ配置
// ========================================

function applyTerminalOperations(
  train,
  stations
) {

  const result =
    stations.map(
      station => ({

        ...station,

        operationRemarks:
          Array.isArray(
            station.operationRemarks
          )
            ? [
                ...station.operationRemarks
              ]
            : []

      })
    )


  /*
   * _operationLines
   */

  const lines =
    Array.isArray(train?.operationLines)
      ? train.operationLines
      : Array.isArray(train?._operationLines)
        ? train._operationLines
        : []


  /*
   * B側 → 始発
   */

  lines
    .filter(
      operation =>
        operation?.side ===
        "B"
    )
    .forEach(
      operation => {

        const notes =
          Array.isArray(
            operation.notes
          )
            ? operation.notes
            : []


        notes.forEach(
          note => {

            const text =
              buildOperationText(
                note
              )


            if (
              !text ||
              result.length === 0
            ) {

              return

            }


            const target =
              result[0]


            const duplicate =
              target.operationRemarks
                .some(
                  item =>
                    buildOperationText(
                      item
                    ) ===
                    text
                )


            if (
              !duplicate
            ) {

              target.operationRemarks.push(
                {

                  label:
                    note.label ||
                    "",

                  time:
                    note.time ||
                    "",

                  trackName:
                    note.trackName ||
                    note.track ||
                    note.trackKey ||
                    "",

                  trackKey:
                    note.trackKey ||
                    "",

                  side:
                    "B"

                }
              )

            }

          }
        )

      }
    )


  /*
   * A側 → 終着
   */

  lines
    .filter(
      operation =>
        operation?.side ===
        "A"
    )
    .forEach(
      operation => {

        const notes =
          Array.isArray(
            operation.notes
          )
            ? operation.notes
            : []


        notes.forEach(
          note => {

            const text =
              buildOperationText(
                note
              )


            if (
              !text ||
              result.length === 0
            ) {

              return

            }


            const target =
              result[
                result.length - 1
              ]


            const duplicate =
              target.operationRemarks
                .some(
                  item =>
                    buildOperationText(
                      item
                    ) ===
                    text
                )


            if (
              !duplicate
            ) {

              target.operationRemarks.push(
                {

                  label:
                    note.label ||
                    "",

                  time:
                    note.time ||
                    "",

                  trackName:
                    note.trackName ||
                    note.track ||
                    note.trackKey ||
                    "",

                  trackKey:
                    note.trackKey ||
                    "",

                  side:
                    "A"

                }
              )

            }

          }
        )

      }
    )


  return result

}


// ========================================
// Staff
// ========================================

function Staff() {

  const {
    selectedDatasetId
  } =
    useDataset()


  const {
    trainId
  } =
    useParams()


  const [
    searchParams
  ] =
    useSearchParams()

  const trainNo =
    searchParams.get("trainNo") ||
    trainId ||
    ""

  const datasetFromUrl =
    searchParams.get("dataset") ||
    ""


  const [
    train,
    setTrain
  ] =
    useState(null)


  const [
    loading,
    setLoading
  ] =
    useState(true)


  const [
    error,
    setError
  ] =
    useState("")

  const [
    rosterInfo,
    setRosterInfo
  ] =
    useState(null)


  useEffect(() => {

    let cancelled =
      false


    const loadTrain =
      async () => {

        try {

          setLoading(
            true
          )

          setError("")


          const user =
            await getCurrentUser()


          if (
            !user
          ) {

            setError(
              "ACTISアカウントにログインしてください。"
            )

            return

          }


          /*
           * ==================================
           * 自分の列車だけ取得
           * ==================================
           */

          let data = null

          if (trainId) {
            const snapshot =
              await get(
                ref(
                  database,
                  `users/${user.uid}/trains/${trainId}`
                )
              )

            if (snapshot.exists()) {
              data = snapshot.val()
            }
          }
          if (!data && trainNo) {
            const snapshot =
              await get(
                ref(
                  database,
                  `users/${user.uid}/trains`
                )
              )

            if (snapshot.exists()) {
              const allTrains = snapshot.val() || {}
              const wantedDataset =
                datasetFromUrl || selectedDatasetId || ""

              const candidates = Object.entries(allTrains)
                .map(([id, value]) => ({ id, ...(value || {}) }))
                .filter(item =>
                  String(item.trainNo || "") === String(trainNo) &&
                  (!wantedDataset || String(item.datasetId || "") === String(wantedDataset))
                )

              data = candidates[0] || null
            }
          }

          if (cancelled) {
            return
          }

          if (!data) {
            setError(
              "指定された列車が見つかりません。"
            )
            return
          }


          const effectiveDatasetId =
            datasetFromUrl || selectedDatasetId

          // 現在の列車が含まれる乗務員行路を取得
          let matchedRoster = null
          if (effectiveDatasetId) {
            const rosterSnapshot = await get(
              ref(
                database,
                `users/${user.uid}/datasets/${effectiveDatasetId}/crewRosters`
              )
            )

            if (rosterSnapshot.exists()) {
              const rosterValue = rosterSnapshot.val() || {}
              for (const [rosterId, roster] of Object.entries(rosterValue)) {
                const items = Array.isArray(roster?.items) ? roster.items : []
                const itemIndex = items.findIndex(item =>
                  item?.type === "train" &&
                  String(item?.trainId || "") === String(trainId || data.id || "")
                )

                // 列車IDが保存されていない旧データ向けに列番でも照合
                const fallbackIndex = itemIndex >= 0
                  ? itemIndex
                  : items.findIndex(item =>
                      item?.type === "train" &&
                      String(item?.trainNo || "") === String(data.trainNo || "")
                    )

                if (fallbackIndex >= 0) {
                  matchedRoster = {
                    id: rosterId,
                    ...(roster || {}),
                    itemIndex: fallbackIndex,
                    items
                  }
                  break
                }
              }
            }
          }

          if (cancelled) {
            return
          }

          setRosterInfo(matchedRoster)

          if (
            effectiveDatasetId &&
            String(
              data.datasetId || ""
            ) !==
            String(
              effectiveDatasetId
            )
          ) {

            setError(
              "選択中のデータセットに属する列車ではありません。"
            )

            return

          }


          /*
           * ==================================
           * 駅
           * ==================================
           */

          const rawStations =
            Array.isArray(
              data.stations
            )
              ? data.stations
              : []


          let stations =
            rawStations.map(
              station => ({

                ...station,

                name:
                  station?.name ||
                  "",

                track:
                  station?.track ||
                  station?.trackName ||
                  "",

                arrival:
                  station?.arrival ||
                  station?.arr ||
                  "",

                departure:
                  station?.departure ||
                  station?.dep ||
                  "",

                remarks:
                  station?.remarks ||
                  "",

                isPass:
                  station?.isPass === true,

                stopType:
                  String(
                    station?.stopType ??
                    "1"
                  ),

                operationRemarks:
                  Array.isArray(
                    station?.operationRemarks
                  )
                    ? [
                        ...station.operationRemarks
                      ]
                    : []

              })
            )


          /*
           * Operationを付与
           */

          stations =
            applyTerminalOperations(
              data,
              stations
            )


          /*
           * ==================================
           * 運転駅のみ
           * ==================================
           */

          const operatingStations =
            stations.filter(
              station =>
                station.stopType !==
                  "0" &&
                station.stopType !==
                  "3"
            )


          /*
           * ==================================
           * 表示範囲
           * ==================================
           */

          let start =
            -1


          let end =
            -1


          operatingStations.forEach(
            (
              station,
              index
            ) => {

              const hasTime =
                Boolean(
                  station.arrival ||
                  station.departure ||
                  station.single ||
                  station.isPass ||
                  station.operationRemarks?.length
                )


              if (
                hasTime
              ) {

                if (
                  start === -1
                ) {

                  start =
                    index

                }


                end =
                  index

              }

            }
          )


          let displayStations =
            operatingStations


          if (
            start !== -1 &&
            end !== -1
          ) {

            displayStations =
              operatingStations.slice(
                start,
                end + 1
              )

          }


          /*
           * 始発
           */

          if (
            displayStations.length >
            0
          ) {

            displayStations[0] = {

              ...displayStations[0],

              arrival:
                ""

            }

          }


          /*
           * 終着
           */

          if (
            displayStations.length >
            0
          ) {

            const lastIndex =
              displayStations.length - 1


            displayStations[
              lastIndex
            ] = {

              ...displayStations[
                lastIndex
              ],

              departure:
                ""

            }

          }


          /*
           * 行先
           */

          const finalDest =
            displayStations.length >
            0

              ? displayStations[
                  displayStations.length - 1
                ]?.name || ""

              : ""


          if (
            cancelled
          ) {

            return

          }


          setTrain({

            ...data,

            stations:
              displayStations,

            finalDest,

            destination:
              data.destination ||
              finalDest

          })

        }

        catch (
          err
        ) {

          console.error(
            "Staff load error:",
            err
          )


          if (
            !cancelled
          ) {

            setError(
              `列車データを取得できませんでした：${err.message}`
            )

          }

        }

        finally {

          if (
            !cancelled
          ) {

            setLoading(
              false
            )

          }

        }

      }


    loadTrain()


    return () => {

      cancelled =
        true

    }

  }, [trainId, trainNo, datasetFromUrl, selectedDatasetId])


  if (
    loading
  ) {

    return (

      <div>

        <h1>
          スタフ表示
        </h1>

        <p>
          読み込み中...
        </p>

      </div>

    )

  }


  if (
    error
  ) {

    return (

      <div>

        <h1>
          スタフ表示
        </h1>

        <p>
          {error}
        </p>

      </div>

    )

  }


  if (
    !train
  ) {

    return null

  }


  const currentRosterItem = rosterInfo?.items?.[rosterInfo.itemIndex] || null

  // 行路一覧から開いたスタフでは、次列車をOUD2の列車連結ではなく
  // 「同じ行路で次に運転する列車」として表示する。
  const nextRosterTrainItem = (() => {
    if (!rosterInfo?.items || rosterInfo.itemIndex === undefined) return null
    for (let i = Number(rosterInfo.itemIndex) + 1; i < rosterInfo.items.length; i += 1) {
      const item = rosterInfo.items[i]
      if (item?.type === "train") return item
    }
    return null
  })()

  // 行路で指定した交代駅を、その駅の「記事」へ入れる。
  // 前交代＝その列車で乗務を開始する駅、後交代＝乗務を終了する駅。
  const rosterStationRemarks = (() => {
    const result = {}
    const before = String(currentRosterItem?.beforeChangeStation || "").trim()
    const after = String(currentRosterItem?.afterChangeStation || "").trim()
    if (before) result[before] = "乗務員交代"
    if (after) result[after] = result[after] ? `${result[after]} / 乗務員交代` : "乗務員交代"
    return result
  })()

  return (

    <div>

      <DatasetSelector />

      <h1>
        スタフ表示
      </h1>


      {rosterInfo && (
        <section className="staff-roster-info">
          <div className="staff-roster-info-head">
            <div>
              <span className="staff-roster-info-label">行路情報</span>
              <h2>{rosterInfo.name || "名称未設定"}</h2>
            </div>
            <span className="staff-roster-info-type">
              {rosterInfo.crewType || "乗務員"}
            </span>
          </div>

          <div className="staff-roster-info-grid">
            <div>
              <span>行路内順序</span>
              <strong>
                {rosterInfo.itemIndex + 1} / {rosterInfo.items.length}
              </strong>
            </div>
            <div>
              <span>列車数</span>
              <strong>
                {rosterInfo.items.filter(item => item?.type === "train").length}列車
              </strong>
            </div>
            <div>
              <span>行路ID</span>
              <strong>{rosterInfo.id}</strong>
            </div>
          </div>

          <div className="staff-roster-info-sequence">
            {rosterInfo.items.map((item, index) => {
              if (item?.type !== "train") {
                const labels = {
                  change: "乗務員交代",
                  break: "休憩",
                  wait: "待機",
                  report: "出勤",
                  finish: "退勤"
                }
                return (
                  <span
                    key={`roster-event-${index}`}
                    className="staff-roster-sequence-event"
                  >
                    {labels[item?.type] || "イベント"}
                  </span>
                )
              }

              const active = String(item.trainId || "") === String(train.id || trainId || "")
                || String(item.trainNo || "") === String(train.trainNo || "")

              return (
                <span
                  key={`roster-train-${index}`}
                  className={`staff-roster-sequence-train ${active ? "active" : ""}`}
                >
                  {item.trainNo || "—"}
                </span>
              )
            })}
          </div>
        </section>
      )}

      <div
        className="trains-container"
      >

        <StaffCard
          train={train}
          rosterItem={currentRosterItem}
          stationRemarks={rosterStationRemarks}
          nextTrainNoOverride={nextRosterTrainItem?.trainNo || ""}
        />

      </div>

    </div>

  )

}


export default Staff

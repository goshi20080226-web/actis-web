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
  useParams
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
    trainId
  } =
    useParams()


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

          const snapshot =
            await get(

              ref(
                database,
                `users/${user.uid}/trains/${trainId}`
              )

            )


          if (
            cancelled
          ) {

            return

          }


          if (
            !snapshot.exists()
          ) {

            setError(
              "指定された列車が見つかりません。"
            )

            return

          }


          const data =
            snapshot.val()


          if (
            selectedDatasetId &&
            String(
              data.datasetId || ""
            ) !==
            String(
              selectedDatasetId
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

  }, [trainId, selectedDatasetId])


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


  return (

    <div>

      <DatasetSelector />

      <h1>
        スタフ表示
      </h1>


      <div
        className="trains-container"
      >

        <StaffCard
          train={train}
        />

      </div>

    </div>

  )

}


export default Staff

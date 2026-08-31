import {
  useEffect,
  useMemo,
  useState
} from "react"

import {
  ref,
  get
} from "firebase/database"

import {
  Link
} from "react-router-dom"

import {
  auth,
  database
} from "../firebase/config"

import {
  useDataset
} from "../context/DatasetContext"

import DatasetSelector from "../components/dataset/DatasetSelector"


function getDirectionLabel(
  direction
) {

  if (
    direction === "Kudari"
  ) {

    return "下り"

  }


  if (
    direction === "Nobori"
  ) {

    return "上り"

  }


  return "—"

}


function getFirstStation(
  train
) {

  if (
    !Array.isArray(
      train?.stations
    )
  ) {

    return null

  }


  return (
    train.stations[0] ||
    null
  )

}


function getLastStation(
  train
) {

  if (
    !Array.isArray(
      train?.stations
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


function getTimeValue(
  station
) {

  if (!station) {
    return ""
  }


  return (
    station.departure ||
    station.dep ||
    station.arrival ||
    station.arr ||
    station.single ||
    ""
  )

}


function formatTime(
  value
) {

  if (!value) {
    return "—"
  }


  const text =
    String(value).trim()


  if (!text) {
    return "—"
  }


  if (
    text.length <= 4
  ) {

    const hour =
      text.slice(
        0,
        -2
      ) || "0"

    const minute =
      text.slice(-2)


    return `${hour}:${minute}`

  }


  const hour =
    text.slice(
      0,
      -4
    ) || "0"


  const minute =
    text.slice(
      -4,
      -2
    )


  return `${hour}:${minute}`

}


function getStartTime(
  train
) {

  return formatTime(
    getTimeValue(
      getFirstStation(
        train
      )
    )
  )

}


function getEndTime(
  train
) {

  return formatTime(
    getTimeValue(
      getLastStation(
        train
      )
    )
  )

}


function getOrigin(
  train
) {

  return (
    train.origin ||
    getFirstStation(
      train
    )?.name ||
    "—"
  )

}


function getDestination(
  train
) {

  return (
    train.destination ||
    train.finalDest ||
    getLastStation(
      train
    )?.name ||
    "—"
  )

}


function getOperationLabel(
  train
) {

  if (!train) {
    return "運用未設定"
  }


  const directValues = [

    train.unyo,

    train.operation,

    train.operationNo,

    train.operationNumber,

    train.unyoNo

  ]


  for (
    const value of directValues
  ) {

    if (
      value === undefined ||
      value === null
    ) {

      continue

    }


    const text =
      String(value).trim()


    if (
      text &&
      text !== "null" &&
      text !== "undefined"
    ) {

      return text

    }

  }


  /*
   * operationLines
   */

  if (
    Array.isArray(
      train.operationLines
    )
  ) {

    for (
      const line of train.operationLines
    ) {

      if (!line) {
        continue
      }


      const lineValues = [

        line.unyo,

        line.operation,

        line.operationNo,

        line.operationNumber,

        line.value

      ]


      for (
        const value of lineValues
      ) {

        if (
          value === undefined ||
          value === null
        ) {

          continue

        }


        const text =
          String(value).trim()


        if (!text) {
          continue
        }


        /*
         * valueがそのまま運用番号の場合
         */

        if (
          !text.includes("/") &&
          !text.includes("$")
        ) {

          return text

        }


        /*
         * $/101
         * $/A01
         * など
         */

        const match =
          text.match(
            /\$\/([^,\s]+)/
          )


        if (
          match &&
          match[1]
        ) {

          const operationName =
            match[1].trim()


          if (
            operationName
          ) {

            return operationName

          }

        }


        /*
         * notes側にも運用番号が
         * 入っている場合
         */

        if (
          Array.isArray(
            line.notes
          )
        ) {

          for (
            const note of line.notes
          ) {

            if (!note) {
              continue
            }

            const noteValues = [

              note.unyo,

              note.operation,

              note.operationNo,

              note.operationNumber

            ]


            for (
              const noteValue
              of noteValues
            ) {

              if (
                noteValue === undefined ||
                noteValue === null
              ) {

                continue

              }


              const noteText =
                String(
                  noteValue
                ).trim()


              if (
                noteText
              ) {

                return noteText

              }

            }

          }

        }

      }

    }

  }


  /*
   * operationsオブジェクト
   */

  if (
    train.operations &&
    typeof train.operations ===
      "object"
  ) {

    const operationValues =
      Object.values(
        train.operations
      )


    for (
      const value of operationValues
    ) {

      if (
        value === undefined ||
        value === null
      ) {

        continue

      }


      const text =
        String(value).trim()


      if (!text) {
        continue
      }


      const match =
        text.match(
          /\$\/([^,\s]+)/
        )


      if (
        match &&
        match[1]
      ) {

        const operationName =
          match[1].trim()


        if (
          operationName
        ) {

          return operationName

        }

      }

    }

  }


  /*
   * operationRemarksに運用番号が
   * 保存されている場合
   */

  if (
    Array.isArray(
      train.operationRemarks
    )
  ) {

    for (
      const remark of train.operationRemarks
    ) {

      if (!remark) {
        continue
      }


      if (
        typeof remark === "string"
      ) {

        const match =
          remark.match(
            /\$\/([^,\s]+)/
          )


        if (
          match &&
          match[1]
        ) {

          return match[1].trim()

        }


        continue

      }


      const values = [

        remark.unyo,

        remark.operation,

        remark.operationNo,

        remark.operationNumber

      ]


      for (
        const value of values
      ) {

        if (
          value === undefined ||
          value === null
        ) {

          continue

        }


        const text =
          String(value).trim()


        if (
          text
        ) {

          return text

        }

      }

    }

  }


  return "運用未設定"

}

function sortOperationTrains(
  a,
  b
) {

  const sequenceA =
    Number(
      a.operationSequence
    )


  const sequenceB =
    Number(
      b.operationSequence
    )


  const validA =
    Number.isFinite(
      sequenceA
    )


  const validB =
    Number.isFinite(
      sequenceB
    )


  if (
    validA &&
    validB
  ) {

    return (
      sequenceA -
      sequenceB
    )

  }


  if (validA) {
    return -1
  }


  if (validB) {
    return 1
  }


  return String(
    a.trainNo || ""
  ).localeCompare(
    String(
      b.trainNo || ""
    ),
    undefined,
    {
      numeric: true
    }
  )

}


function TrainCard({
  train,
  index,
  total
}) {

  const previous =
    train.previousTrainNo ||
    ""


  const next =
    train.nextTrainNo ||
    ""


  return (

    <div
      className="operation-train-wrapper"
    >

      <Link
        to={
          `/staff/${train.id}`
        }

        className="operation-train-card"
      >

        <div
          className="operation-train-sequence"
        >

          {train.operationSequence ||
            index + 1}

        </div>


        <div
          className="operation-train-main"
        >

          <div
            className="operation-train-top"
          >

            <span
              className="operation-train-no"
            >

              {train.trainNo ||
                "—"}

            </span>


            <span
              className="operation-train-type"
            >

              {train.typeShort ||
                train.type ||
                "—"}

            </span>


            <span
              className="operation-train-direction"
            >

              {getDirectionLabel(
                train.direction
              )}

            </span>

          </div>


          <div
            className="operation-train-route"
          >

            <span>
              {getOrigin(
                train
              )}
            </span>


            <span
              className="operation-route-arrow"
            >
              →
            </span>


            <strong>
              {getDestination(
                train
              )}
            </strong>

          </div>


          <div
            className="operation-train-time"
          >

            <span>
              {getStartTime(
                train
              )}
            </span>


            <span>
              →
            </span>


            <span>
              {getEndTime(
                train
              )}
            </span>

          </div>

        </div>


        <div
          className="operation-train-next"
        >

          {previous && (

            <span>
              前 {previous}
            </span>

          )}


          {next && (

            <span>
              次 {next}
            </span>

          )}

        </div>

      </Link>


      {index <
        total - 1 && (

        <div
          className="operation-connector"
        >

          <div
            className="operation-connector-line"
          />

          <div
            className="operation-connector-arrow"
          >
            ↓
          </div>

        </div>

      )}

    </div>

  )

}


function OperationGroup({
  operation,
  trains
}) {

  const sortedTrains =
    [...trains].sort(
      sortOperationTrains
    )


  const firstTrain =
    sortedTrains[0]


  const lastTrain =
    sortedTrains[
      sortedTrains.length - 1
    ]


  const directions = [
    ...new Set(
      sortedTrains
        .map(
          train =>
            getDirectionLabel(
              train.direction
            )
        )
        .filter(
          value =>
            value !== "—"
        )
    )
  ]


  return (

    <section
      className="operation-group"
    >

      <div
        className="operation-title"
      >

        <span>
          運用
        </span>


        <strong>
          {operation}
        </strong>


        <span
          className="operation-count"
        >

          {sortedTrains.length}
          列車

        </span>

      </div>


      <div
        className="operation-summary"
      >

        <div
          className="operation-summary-item"
        >

          <span
            className="operation-summary-label"
          >
            開始
          </span>


          <strong>
            {firstTrain
              ? getOrigin(
                  firstTrain
                )
              : "—"}
          </strong>

        </div>


        <div
          className="operation-summary-arrow"
        >
          →
        </div>


        <div
          className="operation-summary-item"
        >

          <span
            className="operation-summary-label"
          >
            終了
          </span>


          <strong>
            {lastTrain
              ? getDestination(
                  lastTrain
                )
              : "—"}
          </strong>

        </div>


        <div
          className="operation-summary-direction"
        >

          {directions.join(
            " / "
          ) || "方向不明"}

        </div>

      </div>


      <div
        className="operation-train-chain"
      >

        {sortedTrains.map(
          (
            train,
            index
          ) => (

            <TrainCard
              key={
                train.id
              }

              train={
                train
              }

              index={
                index
              }

              total={
                sortedTrains.length
              }
            />

          )
        )}

      </div>

    </section>

  )

}


function Trains() {

  const {
    selectedDatasetId,
    selectedDataset
  } = useDataset()

  const [trains, setTrains] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState("")


  useEffect(() => {

    let cancelled = false


    const loadTrains =
      async () => {

        try {

          setLoading(true)
          setError("")


          const user =
            auth.currentUser


          if (!user) {

            setError(
              "Discordでログインしてください。"
            )

            return

          }


          const snapshot =
            await get(

              ref(
                database,
                `users/${user.uid}/trains`
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

            setTrains([])

            return

          }


          const data =
            snapshot.val()


          const list =
            Object.entries(
              data
            )
              .filter(
                ([, train]) =>
                  !selectedDatasetId ||
                  train?.datasetId === selectedDatasetId
              )
              .map(
              (
                [id, train]
              ) => ({

                id,

                ...train

              })
            )


          setTrains(
            list
          )

        }

        catch (err) {

          console.error(
            "Trains load error:",
            err
          )


          if (
            !cancelled
          ) {

            setError(
              "列車データを取得できませんでした。"
            )

          }

        }

        finally {

          if (
            !cancelled
          ) {

            setLoading(false)

          }

        }

      }


    loadTrains()


    return () => {

      cancelled = true

    }

  }, [selectedDatasetId])


  const operationGroups =
    useMemo(
      () => {

        const groups = {}


        for (
          const train
          of trains
        ) {

          const operation =
            getOperationLabel(
              train
            )


          if (
            !groups[
              operation
            ]
          ) {

            groups[
              operation
            ] = []

          }


          groups[
            operation
          ].push(
            train
          )

        }


        return groups

      },
      [trains]
    )


  const operationNames =
    useMemo(
      () => {

        return Object.keys(
          operationGroups
        ).sort(
          (
            a,
            b
          ) => {

            if (
              a ===
              "運用未設定"
            ) {

              return 1

            }


            if (
              b ===
              "運用未設定"
            ) {

              return -1

            }


            return a.localeCompare(
              b,
              undefined,
              {
                numeric: true
              }
            )

          }
        )

      },
      [operationGroups]
    )


  const configuredCount =
    useMemo(
      () =>
        operationNames.filter(
          operation =>
            operation !==
            "運用未設定"
        ).length,
      [operationNames]
    )


  const unconfiguredCount =
    operationGroups[
      "運用未設定"
    ]?.length || 0


  if (
    loading
  ) {

    return (

      <div
        className="trains-page"
      >

        <h1>
          運用一覧
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

      <div
        className="trains-page"
      >

        <h1>
          運用一覧
        </h1>


        <p>
          {error}
        </p>

      </div>

    )

  }


  return (

    <div
      className="trains-page"
    >

      <DatasetSelector />

      {selectedDataset && (
        <p className="trains-description">
          データセット：{selectedDataset.fileName || selectedDataset.railwayName || selectedDataset.id}
        </p>
      )}

      <div
        className="trains-header"
      >

        <div>

          <h1>
            運用一覧
          </h1>


          <p
            className="trains-description"
          >
            自分がアップロードした
            OUD2データの運用を表示します。
          </p>

        </div>


        <div
          className="trains-stat"
        >

          <div>

            <strong>
              {trains.length}
            </strong>

            <span>
              列車
            </span>

          </div>


          <div>

            <strong>
              {configuredCount}
            </strong>

            <span>
              運用
            </span>

          </div>


          {unconfiguredCount >
            0 && (

            <div>

              <strong>
                {unconfiguredCount}
              </strong>

              <span>
                未設定
              </span>

            </div>

          )}

        </div>

      </div>


      {operationNames.length === 0 ? (

        <div
          className="trains-empty"
        >

          <p>
            列車データがありません。
          </p>

        </div>

      ) : (

        <div
          className="operations-list"
        >

          {operationNames.map(
            operation => (

              <OperationGroup
                key={
                  operation
                }

                operation={
                  operation
                }

                trains={
                  operationGroups[
                    operation
                  ]
                }
              />

            )
          )}

        </div>

      )}

    </div>

  )

}


export default Trains
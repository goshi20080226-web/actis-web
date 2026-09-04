import {
  useEffect,
  useMemo,
  useState
} from "react"

import {
  onAuthStateChanged
} from "firebase/auth"

import {
  get,
  ref
} from "firebase/database"

import {
  auth,
  database
} from "../firebase/config"

import {
  useDataset
} from "../context/DatasetContext"

import DatasetSelector from "../components/dataset/DatasetSelector"


function getCurrentUser() {

  return new Promise(
    resolve => {

      if (auth.currentUser) {

        resolve(auth.currentUser)

        return

      }

      const unsubscribe =
        onAuthStateChanged(
          auth,
          user => {

            unsubscribe()

            resolve(user)

          }
        )

    }
  )

}


// ========================================
// 時刻
// ========================================

function passengerTime(value) {

  if (
    value === undefined ||
    value === null
  ) {

    return ""
  }

  const text =
    String(value).trim()

  if (!text) {
    return ""
  }

  /*
   * OUD2のEkiJikokuは
   * 600 / 0630 / 123045 のような
   * コロンなし形式で保存される。
   *
   * 旅客用表示では常に HH:MM にする。
   * 秒は表示しない。
   */

  const colonMatch =
    text.match(
      /^(\d{1,2})[:：](\d{2})(?::\d{2})?/
    )

  if (colonMatch) {

    return (
      String(
        Number(colonMatch[1])
      ).padStart(
        2,
        "0"
      ) +
      ":" +
      colonMatch[2]
    )

  }

  const digits =
    text.replace(
      /[^0-9]/g,
      ""
    )

  if (
    digits.length < 3
  ) {

    return ""

  }

  let hour = ""
  let minute = ""

  if (
    digits.length <= 4
  ) {

    hour =
      digits.slice(
        0,
        -2
      ) || "0"

    minute =
      digits.slice(
        -2
      )

  } else {

    hour =
      digits.slice(
        0,
        -4
      ) || "0"

    minute =
      digits.slice(
        -4,
        -2
      )

  }

  const hourNumber =
    Number(hour)

  const minuteNumber =
    Number(minute)

  if (
    !Number.isFinite(hourNumber) ||
    !Number.isFinite(minuteNumber) ||
    minuteNumber > 59
  ) {

    return ""

  }

  return (
    String(
      hourNumber
    ).padStart(
      2,
      "0"
    ) +
    ":" +
    String(
      minuteNumber
    ).padStart(
      2,
      "0"
    )
  )

}


function timeSortValue(value) {

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {

    return Number.MAX_SAFE_INTEGER

  }

  const text =
    String(value).trim()

  const colonMatch =
    text.match(
      /^(\d{1,2})[:：](\d{2})(?::(\d{2}))?/
    )

  if (colonMatch) {

    return (
      Number(colonMatch[1]) * 3600 +
      Number(colonMatch[2]) * 60 +
      Number(colonMatch[3] || 0)
    )

  }

  const digits =
    text.replace(
      /[^0-9]/g,
      ""
    )

  if (
    digits.length < 3
  ) {

    return Number.MAX_SAFE_INTEGER

  }

  let hour = 0
  let minute = 0
  let second = 0

  if (
    digits.length <= 4
  ) {

    hour =
      Number(
        digits.slice(
          0,
          -2
        )
      )

    minute =
      Number(
        digits.slice(
          -2
        )
      )

  } else {

    hour =
      Number(
        digits.slice(
          0,
          -4
        )
      )

    minute =
      Number(
        digits.slice(
          -4,
          -2
        )
      )

    second =
      Number(
        digits.slice(
          -2
        )
      )

  }

  if (
    minute > 59 ||
    second > 59
  ) {

    return Number.MAX_SAFE_INTEGER

  }

  return (
    hour * 3600 +
    minute * 60 +
    second
  )

}



// ========================================
// 種別色
// ========================================

function normalizeColor(value) {

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return ""
  }


  // すでにCSSカラー文字列の場合
  if (
    typeof value === "string"
  ) {

    const text =
      value.trim()


    if (/^#[0-9a-fA-F]{6}$/.test(text)) {
      return text
    }

    if (/^#[0-9a-fA-F]{3}$/.test(text)) {
      return text
    }


    // rgb(255, 0, 0)
    if (
      /^rgb\(/i.test(text)
    ) {

      return text

    }


    // OUD2の 0xRRGGBB 表記
    const hexMatch =
      text.match(
        /^0x([0-9a-fA-F]{6})$/
      )


    if (
      hexMatch
    ) {

      return "#" +
        hexMatch[1]

    }


    // OUD2の 16進数が#なしで入っている場合
    if (
      /^[0-9a-fA-F]{6}$/.test(text)
    ) {

      return "#" +
        text

    }

    return ""

  }


  // {r,g,b} / {red,green,blue}
  if (
    typeof value ===
    "object"
  ) {

    const r =
      Number(
        value.r ??
        value.red ??
        value.R
      )

    const g =
      Number(
        value.g ??
        value.green ??
        value.G
      )

    const b =
      Number(
        value.b ??
        value.blue ??
        value.B
      )


    if (
      Number.isFinite(r) &&
      Number.isFinite(g) &&
      Number.isFinite(b)
    ) {

      const clamp =
        number =>
          Math.max(
            0,
            Math.min(
              255,
              number
            )
          )


      return "#" +
        [r, g, b]
          .map(
            number =>
              Math.round(
                clamp(number)
              )
              .toString(16)
              .padStart(2, "0")
          )
          .join("")

    }

  }


  // 数値の0xRRGGBB / RRGGBB
  if (
    typeof value ===
    "number" &&
    Number.isFinite(value)
  ) {

    const number =
      Math.max(
        0,
        Math.min(
          0xffffff,
          Math.round(value)
        )
      )


    return "#" +
      number
        .toString(16)
        .padStart(6, "0")

  }


  return ""
}


function getTrainTypeColor(train) {

  if (!train) {
    return ""
  }


  /*
   * OUD2の種別色を最優先。
   * trainTypeColor はアップロード時に
   * JikokuhyouMojiColor を保存する想定。
   */

  const candidates = [
    train.trainTypeColor,

    train.JikokuhyouMojiColor,

    train.jikokuhyouMojiColor,

    train.typeColor,

    train.syubetsuColor,

    train.color,

    train.syubetsu?.JikokuhyouMojiColor,

    train.syubetsu?.jikokuhyouMojiColor,

    train.syubetsu?.color,

    train.typeInfo?.JikokuhyouMojiColor,

    train.typeInfo?.jikokuhyouMojiColor,

    train.typeInfo?.color,

    train.type?.JikokuhyouMojiColor,

    train.type?.jikokuhyouMojiColor,

    train.type?.color

  ]


  for (
    const candidate
    of candidates
  ) {

    const color =
      normalizeColor(
        candidate
      )


    if (color) {
      return color
    }
  }

  return ""
}


// ========================================
// 駅略称
// ========================================

function buildStationShortNameMap(
  lines
) {

  const map = {}

  lines.forEach(
    line => {

      const stations =
        Array.isArray(
          line?.stations
        )
          ? line.stations
          : []

      stations.forEach(
        station => {

          const full =
            String(
              station?.name ||
              ""
            ).trim()

          const short =
            String(
              station?.shortName ||
              station?.timeName ||
              station?.EkimeiJikokuRyaku ||
              full
            ).trim()

          if (full) {

            map[full] =
              short || full

          }

          if (short) {

            map[short] =
              short

          }

        }
      )

    }
  )

  return map

}


// ========================================
// 駅名一致
// ========================================

function stationMatches(
  station,
  selectedName
) {

  if (!station || !selectedName) {
    return false
  }

  const normalizeName =
    value =>
      String(value || "")
        .replace(/\s+/g, "")
        .trim()

  const target =
    normalizeName(
      selectedName
    )

  const names = [

    station.name,

    station.Ekimei,

    station.stationName,

    station.shortName,

    station.timeName,

    station.EkimeiJikokuRyaku

  ]

    .filter(Boolean)
    .map(
      normalizeName
    )

  return names.includes(
    target
  )

}


// ========================================
// Timetable
// ========================================

function Timetable() {

  const {
    selectedDatasetId,
    selectedDataset
  } = useDataset()

  const [
    lines,
    setLines
  ] =
    useState([])

  const [
    trains,
    setTrains
  ] =
    useState([])

  const [
    selectedLine,
    setSelectedLine
  ] =
    useState("")

  const [
    selectedStation,
    setSelectedStation
  ] =
    useState("")

  const [
    direction,
    setDirection
  ] =
    useState("Kudari")

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


  // ======================================
  // Firebase
  // ======================================

  useEffect(() => {

    let cancelled = false

    const load =
      async () => {

        try {

          setLoading(true)
          setError("")

          const user =
            await getCurrentUser()

          if (!user) {

            setError(
              "ACTISアカウントにログインしてください。"
            )

            return

          }

          const [
            linesSnapshot,
            trainsSnapshot
          ] =
            await Promise.all([

              get(
                ref(
                  database,
                  `users/${user.uid}/lines`
                )
              ),

              get(
                ref(
                  database,
                  `users/${user.uid}/trains`
                )
              )

            ])

          if (cancelled) {
            return
          }

          const lineObject =
            linesSnapshot.exists()
              ? linesSnapshot.val()
              : {}

          const trainObject =
            trainsSnapshot.exists()
              ? trainsSnapshot.val()
              : {}

          const lineList =
            Object.entries(
              lineObject
            )
              .filter(
                ([, value]) =>
                  !selectedDatasetId ||
                  String(
                    value?.datasetId || ""
                  ) ===
                  String(
                    selectedDatasetId
                  )
              )
              .map(
              (
                [id, value]
              ) => ({

                id,

                ...value

              })
            )

          const trainList =
            Object.values(
              trainObject
            ).filter(
              train =>
                !selectedDatasetId ||
                String(
                  train?.datasetId || ""
                ) ===
                String(
                  selectedDatasetId
                )
            )

          setLines(
            lineList
          )

          setTrains(
            trainList
          )

          if (
            lineList.length > 0
          ) {

            setSelectedLine(
              lineList[0].id
            )

          }

        }
        catch (
          err
        ) {

          console.error(
            "Timetable load error:",
            err
          )

          if (!cancelled) {

            setError(
              `時刻表データを取得できませんでした：${err.message}`
            )

          }

        }
        finally {

          if (!cancelled) {

            setLoading(false)

          }

        }

      }

    load()

    return () => {

      cancelled = true

    }

  }, [selectedDatasetId])


  // ======================================
  // 選択路線
  // ======================================

  const currentLine =
    lines.find(
      line =>
        line.id === selectedLine
    ) ||
    null


  // ======================================
  // 駅一覧
  // ======================================

  const stationShortMap =
    useMemo(
      () =>
        buildStationShortNameMap(
          lines
        ),
      [lines]
    )


  const stations =
    useMemo(
      () => {

        const result = []
        const seen = new Set()

        const source =
          currentLine &&
          Array.isArray(
            currentLine.stations
          )

            ? currentLine.stations

            : lines.flatMap(
                line =>
                  Array.isArray(
                    line.stations
                  )
                    ? line.stations
                    : []
              )

        source.forEach(
          station => {

            const name =
              String(
                station?.name ||
                station?.shortName ||
                ""
              ).trim()

            if (!name) {
              return
            }

            const shortName =
              String(
                station?.shortName ||
                station?.timeName ||
                station?.EkimeiJikokuRyaku ||
                name
              ).trim()

            if (
              seen.has(name)
            ) {

              return

            }

            seen.add(name)

            result.push({

              name,

              shortName:
                shortName || name

            })

          }
        )

        return result

      },
      [
        currentLine,
        lines
      ]
    )


  useEffect(() => {

    if (
      stations.length === 0
    ) {

      setSelectedStation("")

      return

    }

    const exists =
      stations.some(
        station =>
          station.name ===
            selectedStation
      )

    if (!exists) {

      setSelectedStation(
        stations[0].name
      )

    }

  }, [
    stations,
    selectedStation
  ])


  // ======================================
  // 路線に属する列車
  // ======================================

  const timetableRows =
    useMemo(
      () => {

        if (
          !selectedStation
        ) {

          return []

        }

        const rows = []

        trains
          .filter(
            train =>
              train?.direction ===
              direction
          )
          .forEach(
            train => {

              const trainStations =
                Array.isArray(
                  train?.stations
                )
                  ? train.stations
                  : []

              const station =
                trainStations.find(
                  item =>
                    stationMatches(
                      item,
                      selectedStation
                    )
                )

              if (!station) {
                return
              }

              /*
               * stopType=2 は通過
               * 旅客用時刻表には出さない
               */

              if (
                station.isPass === true ||
                String(
                  station.stopType
                ) === "2"
              ) {

                return

              }

              const rawTime =
                station.departure ||
                station.single ||
                station.arrival ||
                ""

              const time =
                passengerTime(
                  rawTime
                )

              if (!time) {
                return
              }

              const destinationFull =
                train?.destination ||
                train?.finalDest ||
                (
                  trainStations.length > 0
                    ? trainStations[
                        trainStations.length - 1
                      ]?.name
                    : ""
                )

              const destination =
                stationShortMap[
                  destinationFull
                ] ||
                destinationFull ||
                "—"

              rows.push({

                id:
                  train.trainId ||
                  train.trainNo ||
                  Math.random(),

                time,

                sortTime:
                  timeSortValue(
                    rawTime
                  ),

                type:
                  train?.typeShort ||
                  train?.type ||
                  "普通",

                typeColor:
                  getTrainTypeColor(
                    train
                  ),

                destination,

                train

              })

            }
          )

        return rows.sort(
          (
            a,
            b
          ) =>
            a.sortTime -
            b.sortTime
        )

      },
      [
        trains,
        direction,
        selectedStation,
        stationShortMap
      ]
    )


  // ======================================
  // 時間帯
  // ======================================

  const groupedRows =
    useMemo(
      () => {

        const groups = {}

        timetableRows.forEach(
          row => {

            const hour =
              row.time.slice(
                0,
                2
              )

            if (!groups[hour]) {

              groups[hour] = []

            }

            groups[hour].push(
              row
            )

          }
        )

        return Object.entries(
          groups
        ).sort(
          (
            [a],
            [b]
          ) =>
            Number(a) -
            Number(b)
        )

      },
      [timetableRows]
    )


  // ======================================
  // 表示
  // ======================================

  if (loading) {

    return (

      <div
        className="passenger-timetable-page"
      >

        <h1>
          時刻表
        </h1>

        <p>
          読み込み中...
        </p>

      </div>

    )

  }


  if (error) {

    return (

      <div
        className="passenger-timetable-page"
      >

        <h1>
          時刻表
        </h1>

        <p>
          {error}
        </p>

      </div>

    )

  }


  return (

    <div
      className="passenger-timetable-page"
    >

      <div
        className="passenger-timetable-header"
      >

        <DatasetSelector />

        {selectedDataset && (
          <p>{selectedDataset.fileName || selectedDataset.railwayName || selectedDataset.id}</p>
        )}

        <div>

          <h1>
            時刻表
          </h1>

          <p>
            駅の発車時刻をご案内します。
          </p>

        </div>

      </div>


      <div
        className="passenger-timetable-controls"
      >

        <label>

          <span>
            路線
          </span>

          <select
            value={
              selectedLine
            }
            onChange={
              event =>
                setSelectedLine(
                  event.target.value
                )
            }
          >

            {
              lines.map(
                line => (

                  <option
                    key={
                      line.id
                    }
                    value={
                      line.id
                    }
                  >

                    {
                      line.name ||
                      line.railwayName ||
                      "路線"
                    }

                  </option>

                )
              )
            }

          </select>

        </label>


        <label>

          <span>
            駅
          </span>

          <select
            value={
              selectedStation
            }
            onChange={
              event =>
                setSelectedStation(
                  event.target.value
                )
            }
          >

            {
              stations.map(
                station => (

                  <option
                    key={
                      `${station.name}-${station.shortName}`
                    }
                    value={
                      station.name
                    }
                  >

                    {
                      station.shortName
                    }

                  </option>

                )
              )
            }

          </select>

        </label>


        <div
          className="passenger-direction-tabs"
        >

          <button
            type="button"
            className={
              direction === "Kudari"
                ? "active"
                : ""
            }
            onClick={() =>
              setDirection(
                "Kudari"
              )
            }
          >

            下り

          </button>


          <button
            type="button"
            className={
              direction === "Nobori"
                ? "active"
                : ""
            }
            onClick={() =>
              setDirection(
                "Nobori"
              )
            }
          >

            上り

          </button>

        </div>

      </div>


      <div
        className="passenger-timetable-title"
      >

        <div>

          <strong>
            {
              stations.find(
                station =>
                  station.name ===
                  selectedStation
              )?.shortName ||
              selectedStation ||
              "駅"
            }
          </strong>

          <span>
            駅
          </span>

        </div>


        <div
          className="passenger-timetable-direction"
        >

          {
            direction ===
            "Kudari"
              ? "下り"
              : "上り"
          }

        </div>

      </div>


      {
        groupedRows.length === 0

          ? (

            <div
              className="passenger-timetable-empty"
            >

              この駅の時刻表データがありません。

            </div>

          )

          : (

            <div
              className="passenger-timetable-list"
            >

              {
                groupedRows.map(
                  (
                    [
                      hour,
                      rows
                    ]
                  ) => (

                    <section
                      key={
                        hour
                      }
                      className="passenger-hour-section"
                    >

                      <div
                        className="passenger-hour"
                      >

                        {
                          Number(
                            hour
                          )
                        }

                        <span>
                          時
                        </span>

                      </div>


                      <div
                        className="passenger-hour-trains"
                      >

                        {
                          rows.map(
                            row => (

                              <div
                                key={
                                  row.id
                                }
                                className="passenger-train-row"
                              >

                                <div
                                  className="passenger-time"
                                >

                                  {
                                    row.time
                                  }

                                </div>


                                <div
                                  className="passenger-type"
                                  style={
                                    row.typeColor
                                      ? {
                                          color:
                                            row.typeColor,
                                          backgroundColor:
                                            "#ffffff"
                                        }
                                      : undefined
                                  }
                                >

                                  {
                                    row.type
                                  }

                                </div>


                                <div
                                  className="passenger-destination"
                                >

                                  {
                                    row.destination
                                  }

                                </div>

                              </div>

                            )
                          )
                        }

                      </div>

                    </section>

                  )
                )
              }

            </div>

          )
      }

    </div>

  )

}


export default Timetable

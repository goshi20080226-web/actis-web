function getTrackDisplay(station) {
  // パーサーが OUD2 の当該駅の TrackRyakusyou から解決した値を最優先で使用。
  const resolved = String(station?.track ?? "").trim()
  if (resolved) return resolved

  // 古い保存データ向け。固定の番線一覧や1始まり/0始まりの決め打ちはしない。
  const raw = String(station?.trackIdx ?? station?.trackKey ?? "").trim()
  const tracks = Array.isArray(station?.tracks) ? station.tracks : []
  if (!raw || !tracks.length) return ""

  // trackIdx が駅自身の TrackRyakusyou 配列の添字として保存されている場合のみ参照。
  const index = /^\d+$/.test(raw) ? Number(raw) : NaN
  if (Number.isInteger(index) && index >= 0 && index < tracks.length) {
    const value = String(tracks[index] ?? "").trim()
    if (value) return value
  }

  // すでに TrackRyakusyou の値そのものが保存されている場合。
  const exact = tracks.find((value) => String(value ?? "").trim() === raw)
  return exact !== undefined ? String(exact).trim() : ""
}

function parseTime(value) {
  if (value === undefined || value === null || value === "") return null

  const digits = String(value).trim().replace(/:/g, "")
  if (!/^\d+$/.test(digits)) return null

  if (digits.length <= 4) {
    return {
      hour: digits.slice(0, -2) || "0",
      minute: digits.slice(-2),
      second: "00"
    }
  }

  return {
    hour: digits.slice(0, -4) || "0",
    minute: digits.slice(-4, -2),
    second: digits.slice(-2)
  }
}

function formatTime(value, className = "") {
  const time = parseTime(value)
  if (!time) return null

  return (
    <div className={`time-wrap ${className}`.trim()} aria-label={`${time.hour}:${time.minute}:${time.second}`}>
      <span className="time-h">{time.hour}</span>
      <span className="time-separator">:</span>
      <span className="time-m">{time.minute}</span>
      <span className="time-separator">:</span>
      <span className="time-s">{time.second}</span>
    </div>
  )
}

function resolveTrackRyakusyou(station, trackValue) {
  const raw = String(trackValue ?? "").trim()
  if (!raw) return ""

  const tracks = Array.isArray(station?.tracks)
    ? station.tracks
    : []

  if (!tracks.length) return ""

  /*
   * この駅自身の TrackRyakusyou 配列を参照する。
   * TrackRyakusyou の件数・値はデータごと、駅ごとに異なるため
   * 固定の番線マップは使用しない。
   */
  const numeric = /^-?\d+$/.test(raw)
    ? Number(raw)
    : NaN

  if (Number.isInteger(numeric)) {
    if (
      numeric >= 0 &&
      numeric < tracks.length &&
      tracks[numeric] !== undefined &&
      String(tracks[numeric]).trim() !== ""
    ) {
      return String(tracks[numeric]).trim()
    }

    // 1始まりのデータにも対応。
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

  const exact = tracks.find(
    (value) => String(value ?? "").trim() === raw
  )

  return exact !== undefined
    ? String(exact).trim()
    : ""
}

function formatRemark(remark, station) {
  if (!remark) return ""
  if (typeof remark === "string") return remark.trim()

  let label = String(remark.label || "").trim()
  if (label === "入区") label = "入庫"

  const time = String(remark.time || "").trim()
  const rawTrack = remark.trackName || remark.track || remark.trackKey || ""
  const track = resolveTrackRyakusyou(station, rawTrack)

  return [label, time, track].filter(Boolean).join(" ")
}

function getRemarks(station, stationRemarks = {}) {
  const result = []
  const operationRemarks = Array.isArray(station?.operationRemarks) ? station.operationRemarks : []

  for (const remark of operationRemarks) {
    const text = formatRemark(remark, station)
    if (text) result.push(text)
  }

  const stationName = String(station?.name || "").trim()
  const stationShortName = String(station?.shortName || "").trim()
  const crewChange = String(
    stationRemarks?.[stationName] || stationRemarks?.[stationShortName] || ""
  ).trim()

  if (crewChange) result.push(crewChange)

  const manualRemark = String(station?.remarks || "").trim()
  if (manualRemark) result.push(manualRemark)

  return [...new Set(result)]
}

function isOperationRemark(text) {
  return /^(出庫|入庫|入換発)/.test(String(text).trim())
}

function StaffTable({ stations = [], stationRemarks = {} }) {
  return (
    <div className="staff-table-wrap">
      <table className="staf-table">
        <colgroup>
          <col style={{ width: "27%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "19%" }} />
          <col style={{ width: "19%" }} />
          <col style={{ width: "24%" }} />
        </colgroup>

        <thead>
          <tr>
            <th>駅名</th>
            <th>番線</th>
            <th>着時刻</th>
            <th>発時刻</th>
            <th>記事</th>
          </tr>
        </thead>

        <tbody>
          {stations.map((station, index) => {
            const arrival = station?.arrival || station?.arr || ""
            const departure = station?.departure || station?.dep || ""
            const isPass = station?.isPass === true
            const track = getTrackDisplay(station)
            const remarks = getRemarks(station, stationRemarks)
            const isFirst = index === 0
            const isLast = index === stations.length - 1

            return (
              <tr
                key={index}
                className={[
                  isFirst ? "staff-row-first" : "",
                  isLast ? "staff-row-last" : ""
                ].filter(Boolean).join(" ")}
              >
                <td className="st-name">
                  <div className="staff-station-name">{station?.name || ""}</div>
                </td>

                <td className="track-val">{track || ""}</td>

                <td className="staff-time-cell">
                  {!isPass && formatTime(arrival)}
                </td>

                <td className="staff-time-cell">
                  {isPass ? (
                    <span className="pass-mark">レ</span>
                  ) : (
                    formatTime(departure)
                  )}
                </td>

                <td className="rem-val">
                  {remarks.length > 0 ? (
                    <div className="staff-row-remarks">
                      {remarks.map((remark, remarkIndex) => (
                        <div
                          key={remarkIndex}
                          className={isOperationRemark(remark) ? "operation-remark" : "manual-remark"}
                        >
                          {remark}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="remark-empty"> </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default StaffTable

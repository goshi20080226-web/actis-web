function getTrackDisplay(station) {
  if (station?.track === undefined || station?.track === null || station.track === "") {
    return ""
  }

  const trackKey = String(station.track).trim()

  if (station.trackName) return String(station.trackName)

  if (Array.isArray(station.tracks)) {
    const index = Number(trackKey)
    if (Number.isInteger(index) && station.tracks[index] !== undefined && station.tracks[index] !== "") {
      return String(station.tracks[index])
    }
  }

  return trackKey
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

function formatRemark(remark) {
  if (!remark) return ""
  if (typeof remark === "string") return remark.trim()

  let label = String(remark.label || "").trim()
  if (label === "入区") label = "入庫"

  const time = String(remark.time || "").trim()
  const track = String(remark.trackName || remark.track || remark.trackKey || "").trim()

  return [label, time, track].filter(Boolean).join(" ")
}

function getRemarks(station) {
  const result = []
  const operationRemarks = Array.isArray(station?.operationRemarks) ? station.operationRemarks : []

  for (const remark of operationRemarks) {
    const text = formatRemark(remark)
    if (text) result.push(text)
  }

  const manualRemark = String(station?.remarks || "").trim()
  if (manualRemark) result.push(manualRemark)

  return [...new Set(result)]
}

function isOperationRemark(text) {
  return /^(出庫|入庫|入換発)/.test(String(text).trim())
}

function StaffTable({ stations = [] }) {
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
            const remarks = getRemarks(station)
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

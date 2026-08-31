import StaffTable from "./StaffTable"

function getOperationNumber(train) {
  if (!train) return ""

  const directValues = [
    train.unyo,
    train.operation,
    train.operationNo,
    train.operationNumber,
    train.unyoNo
  ]

  for (const value of directValues) {
    if (value === undefined || value === null) continue
    const text = String(value).trim()
    if (text && text !== "運用未設定") return text
  }

  const lines = Array.isArray(train.operationLines) ? train.operationLines : []
  for (const line of lines) {
    if (!line) continue

    const notes = Array.isArray(line.notes) ? line.notes : []
    for (const note of notes) {
      for (const value of [note?.unyo, note?.operation, note?.operationNo, note?.operationNumber]) {
        if (value === undefined || value === null) continue
        const text = String(value).trim()
        if (text) return text
      }
    }

    const match = String(line.value || "").match(/\$\/([^,]+)/)
    if (match?.[1]) return match[1].trim()
  }

  return ""
}

function formatRemark(remark) {
  if (!remark) return ""
  if (typeof remark === "string") return remark.trim()

  let label = String(remark.label || "").trim()
  if (label === "入区") label = "入庫"

  return [
    label,
    String(remark.time || "").trim(),
    String(remark.trackName || remark.track || remark.trackKey || "").trim()
  ].filter(Boolean).join(" ")
}

function getOperationRemarks(train) {
  const result = []
  const source = Array.isArray(train?.operationRemarks) ? train.operationRemarks : []

  for (const remark of source) {
    const text = formatRemark(remark)
    if (text) result.push(text)
  }

  return [...new Set(result)]
}

function formatType(train) {
  return train?.typeShort || train?.type || "—"
}

function StaffCard({ train }) {
  const stations = Array.isArray(train?.stations) ? train.stations : []

  const origin = train?.origin || stations[0]?.name || "—"
  const destination = train?.destination || train?.finalDest || stations.at(-1)?.name || "—"
  const operation = getOperationNumber(train)
  const direction = train?.direction === "Kudari" ? "下り" : train?.direction === "Nobori" ? "上り" : ""
  const operationRemarks = getOperationRemarks(train)

  const sequence = train?.operationSequence !== undefined && train?.operationSequence !== null
    ? String(train.operationSequence)
    : ""

  const operationLength = train?.operationLength !== undefined && train?.operationLength !== null
    ? String(train.operationLength)
    : ""

  const previousTrain = train?.previousTrainNo ? String(train.previousTrainNo) : ""
  const nextTrain = train?.nextTrainNo ? String(train.nextTrainNo) : ""

  return (
    <article className="train-block staff-card-modern">
      <header className="staff-card-head">
        <div className="staff-card-type">
          {formatType(train)}
        </div>

        <div className="staff-card-train-no">
          {train?.trainNo || "—"}
        </div>

        {direction && (
          <div className="staff-card-direction">{direction}</div>
        )}
      </header>

      <section className="staff-route-card">
        <div className="staff-route-stop">
          <span>始発</span>
          <strong>{origin}</strong>
        </div>
        <div className="staff-route-arrow">→</div>
        <div className="staff-route-stop staff-route-stop-dest">
          <span>行先</span>
          <strong>{destination}</strong>
        </div>
      </section>

      <section className="staff-meta-grid">
        <div className="staff-meta-item">
          <span>運用</span>
          <strong>{operation || "未設定"}</strong>
        </div>
        <div className="staff-meta-item">
          <span>順序</span>
          <strong>{sequence ? (operationLength ? `${sequence} / ${operationLength}` : sequence) : "—"}</strong>
        </div>
        <div className="staff-meta-item staff-meta-source">
          <span>データ</span>
          <strong title={train?.sourceFile || ""}>{train?.sourceFile || "—"}</strong>
        </div>
      </section>

      <StaffTable stations={stations} />

      <section className="staff-notes">
        <div className="staff-section-title">特記事項</div>
        {operationRemarks.length > 0 ? (
          <div className="staff-summary-remarks">
            {operationRemarks.map((remark, index) => (
              <div key={index} className="staff-summary-remark">
                {remark}
              </div>
            ))}
          </div>
        ) : (
          <div className="staff-notes-empty">特記事項なし</div>
        )}
      </section>

      <footer className="staff-turnback-grid">
        <div className="turnback-info">
          <div className="turnback-title">前列車</div>
          <div className="turnback-val">{previousTrain || "—"}</div>
        </div>
        <div className="turnback-info">
          <div className="turnback-title">次列車</div>
          <div className="turnback-val">{nextTrain || "—"}</div>
        </div>
      </footer>
    </article>
  )
}

export default StaffCard

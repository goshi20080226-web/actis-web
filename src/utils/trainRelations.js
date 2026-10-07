function normalizeName(value) {
  return String(value ?? "").replace(/\s/g, "").trim()
}

export function stationMatches(station, name) {
  const target = normalizeName(name)
  if (!target) return false

  return [
    station?.name,
    station?.shortName,
    station?.timeName,
    station?.Ekimei,
    station?.EkimeiJikokuRyaku
  ]
    .filter(Boolean)
    .some(value => normalizeName(value) === target)
}

function stationAt(train, name) {
  const stations = Array.isArray(train?.stations) ? train.stations : []
  return stations.find(station => stationMatches(station, name)) || null
}

function parseSeconds(value) {
  if (value === undefined || value === null || value === "") return -1

  const digits = String(value).replace(/[^0-9]/g, "")
  if (!digits) return -1

  if (digits.length <= 4) {
    return Number(digits.slice(0, -2) || 0) * 3600 +
      Number(digits.slice(-2)) * 60
  }

  return Number(digits.slice(0, -4) || 0) * 3600 +
    Number(digits.slice(-4, -2)) * 60 +
    Number(digits.slice(-2))
}

function getTrainNumber(train) {
  return String(
    train?.trainNo ??
    train?.Ressyabangou ??
    train?.ressyabangou ??
    train?.trainNumber ??
    train?.number ??
    ""
  ).trim()
}

function getTrainType(train) {
  return String(
    train?.typeShort ??
    train?.type ??
    "普通"
  ).trim()
}

function getDestination(train) {
  return String(
    train?.destination ??
    train?.finalDest ??
    train?.stations?.at?.(-1)?.name ??
    ""
  ).trim()
}

function getTypeColor(train) {
  const values = [
    train?.trainTypeColor,
    train?.JikokuhyouMojiColor,
    train?.jikokuhyouMojiColor,
    train?.trainType?.JikokuhyouMojiColor,
    train?.trainType?.jikokuhyouMojiColor,
    train?.typeInfo?.JikokuhyouMojiColor,
    train?.typeInfo?.jikokuhyouMojiColor
  ]

  for (const value of values) {
    const text = String(value ?? "").trim()

    if (/^#[0-9a-fA-F]{6}$/.test(text)) return text

    // OUD2: 8桁 BGR (00BBGGRR)
    if (/^[0-9a-fA-F]{8}$/.test(text)) {
      return "#" +
        text.slice(6, 8) +
        text.slice(4, 6) +
        text.slice(2, 4)
    }
  }

  return ""
}

function relationStationTime(station) {
  if (!station) return null

  const arrival = parseSeconds(station.arrival ?? station.arr)
  const departure = parseSeconds(station.departure ?? station.dep ?? station.single)

  return {
    arrival,
    departure,
    pass: station.isPass === true || String(station.stopType ?? "") === "2"
  }
}

function isSameDirection(a, b) {
  return !a?.direction || !b?.direction || String(a.direction) === String(b.direction)
}

function isSameDataset(a, b) {
  return !a?.datasetId || !b?.datasetId || String(a.datasetId) === String(b.datasetId)
}

function makeRelation(kind, stationName, train) {
  return {
    kind,
    stationName,
    trainId: String(train?.id || ""),
    trainNo: getTrainNumber(train),
    trainType: getTrainType(train),
    trainTypeColor: getTypeColor(train),
    destination: getDestination(train)
  }
}

export function getWaitAndConnectionRelations(currentTrain, trains = []) {
  const result = {}
  const currentStations = Array.isArray(currentTrain?.stations) ? currentTrain.stations : []

  const currentTrainId = String(currentTrain?.id || "").trim()
  const currentTrainNo = getTrainNumber(currentTrain)

  for (const station of currentStations) {
    const stationName = String(station?.name || "").trim()
    if (!stationName) continue

    const current = relationStationTime(station)
    if (!current || current.departure < 0) continue
    if (station?.isPass === true || String(station?.stopType ?? "") === "2") continue

    const relations = []

    for (const otherTrain of trains) {
      if (!otherTrain) continue

      const otherTrainId = String(otherTrain?.id || "").trim()
      const otherTrainNo = getTrainNumber(otherTrain)

      if (
        (currentTrainId && otherTrainId && currentTrainId === otherTrainId) ||
        (!currentTrainId && currentTrainNo && currentTrainNo === otherTrainNo)
      ) continue
      if (!isSameDataset(currentTrain, otherTrain)) continue
      if (!isSameDirection(currentTrain, otherTrain)) continue

      const otherStation = stationAt(otherTrain, stationName)
      if (!otherStation) continue

      const other = relationStationTime(otherStation)
      if (!other) continue

      const otherTime = other.pass
        ? other.departure
        : other.arrival >= 0
          ? other.arrival
          : other.departure

      if (otherTime < 0) continue

      // 待避:
      // 自列車が先に駅へ着き、相手列車が先に発車する場合。
      // 相手列車が通過する場合は「通過待ち」になる。
      if (
        current.arrival >= 0 &&
        current.arrival <= otherTime &&
        other.departure >= 0 &&
        other.departure < current.departure
      ) {
        relations.push(
          makeRelation(
            other.pass ? "wait-pass" : "wait",
            stationName,
            otherTrain
          )
        )
        continue
      }

      // 連絡:
      // 相手列車が駅に到着してから発車する時間帯に、
      // 自列車の発車時刻が含まれる場合。
      if (
        !other.pass &&
        other.arrival >= 0 &&
        other.departure >= 0 &&
        other.arrival <= current.departure &&
        current.departure <= other.departure
      ) {
        relations.push(
          makeRelation(
            "connection",
            stationName,
            otherTrain
          )
        )
      }
    }

    if (relations.length > 0) {
      result[stationName] = relations
    }
  }

  return result
}

export function filterByDataset(
  items,
  datasetId
) {

  if (
    !Array.isArray(items)
  ) {

    return []

  }


  if (!datasetId) {

    return []

  }


  return items.filter(
    item =>
      String(
        item?.datasetId ||
        ""
      ) ===
      String(
        datasetId
      )
  )

}


export function belongsToDataset(
  item,
  datasetId
) {

  if (
    !item ||
    !datasetId
  ) {

    return false

  }


  return (
    String(
      item.datasetId ||
      ""
    ) ===
    String(
      datasetId
    )
  )

}


export function getDatasetName(
  dataset
) {

  if (!dataset) {

    return "データセット未選択"

  }


  return (
    dataset.fileName ||
    dataset.railwayName ||
    dataset.id
  )

}

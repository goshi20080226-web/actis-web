import {
  useDataset
} from "../../context/DatasetContext"


function DatasetSelector({
  className = ""
}) {

  const {
    datasets,
    selectedDatasetId,
    setSelectedDatasetId,
    loading
  } =
    useDataset()


  return (

    <div
      className={
        `dataset-selector ${className}`
      }
    >

      <label>

        <span>
          データセット
        </span>

        <select
          value={
            selectedDatasetId
          }
          onChange={
            event =>
              setSelectedDatasetId(
                event.target.value
              )
          }
          disabled={
            loading ||
            datasets.length === 0
          }
        >

          {
            datasets.length === 0
              ? (
                <option value="">
                  データセットなし
                </option>
              )
              : (
                datasets.map(
                  dataset => (

                    <option
                      key={
                        dataset.id
                      }
                      value={
                        dataset.id
                      }
                    >

                      {
                        dataset.fileName ||
                        dataset.railwayName ||
                        dataset.id
                      }

                    </option>

                  )
                )
              )
          }

        </select>

      </label>

    </div>

  )

}


export default DatasetSelector

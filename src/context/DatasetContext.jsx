import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react"

import {
  get,
  ref
} from "firebase/database"

import {
  onAuthStateChanged
} from "firebase/auth"

import {
  auth,
  database
} from "../firebase/config"


const STORAGE_KEY =
  "actis.selectedDatasetId"


const DatasetContext =
  createContext(null)


function waitForUser() {

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


function normalizeDataset(id, value) {

  const data =
    value &&
    typeof value === "object"
      ? value
      : {}

  const files =
    Array.isArray(data.files)
      ? data.files
      : []

  const firstFile =
    files[0] &&
    typeof files[0] === "object"
      ? files[0]
      : {}

  return {
    id,
    ...data,
    files,

    fileName:
      data.fileName ||
      firstFile.fileName ||
      files
        .map(file => file?.fileName)
        .filter(Boolean)
        .join(", "),

    railwayName:
      data.railwayName ||
      firstFile.railwayName ||
      files
        .map(file => file?.railwayName)
        .filter(Boolean)
        .join(" / ")
  }

}


export function DatasetProvider({ children }) {

  const [
    datasets,
    setDatasets
  ] = useState([])

  const [
    selectedDatasetId,
    setSelectedDatasetIdState
  ] = useState(
    () =>
      localStorage.getItem(STORAGE_KEY) || ""
  )

  const [
    loading,
    setLoading
  ] = useState(true)

  const [
    error,
    setError
  ] = useState("")


  const setSelectedDatasetId = value => {

    setSelectedDatasetIdState(
      current => {

        const next =
          typeof value === "function"
            ? value(current)
            : value || ""

        if (next) {
          localStorage.setItem(
            STORAGE_KEY,
            next
          )
        }
        else {
          localStorage.removeItem(
            STORAGE_KEY
          )
        }

        return next

      }
    )

  }


  const reloadDatasets = async (
    preferredId = ""
  ) => {

    const user =
      await waitForUser()

    if (!user) {

      setDatasets([])
      setSelectedDatasetIdState("")
      return []

    }

    const snapshot =
      await get(
        ref(
          database,
          `users/${user.uid}/datasets`
        )
      )

    const value =
      snapshot.exists()
        ? snapshot.val()
        : {}

    const list =
      Object.entries(value)
        .map(
          ([id, dataset]) =>
            normalizeDataset(
              id,
              dataset
            )
        )
        .sort(
          (a, b) =>
            Number(
              b.uploadedAt ||
              b.createdAt ||
              0
            ) -
            Number(
              a.uploadedAt ||
              a.createdAt ||
              0
            )
        )

    setDatasets(list)

    const stored =
      preferredId ||
      localStorage.getItem(
        STORAGE_KEY
      )

    const selected =
      list.some(
        dataset =>
          dataset.id === stored
      )
        ? stored
        : list[0]?.id || ""

    setSelectedDatasetIdState(selected)

    if (selected) {
      localStorage.setItem(
        STORAGE_KEY,
        selected
      )
    }
    else {
      localStorage.removeItem(
        STORAGE_KEY
      )
    }

    return list

  }


  useEffect(() => {

    let cancelled = false

    const load = async () => {

      try {

        setLoading(true)
        setError("")

        const list =
          await reloadDatasets()

        if (cancelled) {
          return
        }

        setDatasets(list)

      }
      catch (err) {

        console.error(
          "Dataset load error:",
          err
        )

        if (!cancelled) {
          setError(err.message)
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

  }, [])


  const selectedDataset =
    useMemo(
      () =>
        datasets.find(
          dataset =>
            dataset.id ===
            selectedDatasetId
        ) || null,
      [
        datasets,
        selectedDatasetId
      ]
    )


  const value =
    useMemo(
      () => ({
        datasets,
        selectedDataset,
        selectedDatasetId,
        setSelectedDatasetId,
        reloadDatasets,
        loading,
        error
      }),
      [
        datasets,
        selectedDataset,
        selectedDatasetId,
        loading,
        error
      ]
    )


  return (
    <DatasetContext.Provider value={value}>
      {children}
    </DatasetContext.Provider>
  )

}


export function useDataset() {

  const context =
    useContext(DatasetContext)

  if (!context) {
    throw new Error(
      "useDataset must be used inside DatasetProvider"
    )
  }

  return context

}


export default DatasetContext

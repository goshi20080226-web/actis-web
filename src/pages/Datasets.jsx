import {
  useEffect,
  useState
} from "react"

import {
  ref,
  get,
  update
} from "firebase/database"

import {
  useNavigate
} from "react-router-dom"

import {
  auth,
  database
} from "../firebase/config"

import {
  useDataset
} from "../context/DatasetContext"

import DatasetSelector from "../components/dataset/DatasetSelector"


function formatDate(value) {

  if (!value) {
    return "—"
  }


  const date =
    new Date(value)


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "—"

  }


  return date.toLocaleString(
    "ja-JP",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }
  )

}


function Datasets() {

  const {
    selectedDatasetId,
    setSelectedDatasetId,
    reloadDatasets
  } = useDataset()

  const navigate =
    useNavigate()


  const [
    datasets,
    setDatasets
  ] =
    useState([])


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


  const [
    editingId,
    setEditingId
  ] =
    useState("")


  const [
    editingName,
    setEditingName
  ] =
    useState("")


  const [
    saving,
    setSaving
  ] =
    useState(false)


  // ========================================
  // データセット読み込み
  // ========================================

  const loadDatasets =
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
              `users/${user.uid}/datasets`
            )

          )


        if (
          !snapshot.exists()
        ) {

          setDatasets([])

          return

        }


        const data =
          snapshot.val()


        const list =
          Object.entries(
            data
          )
            .map(
              (
                [id, dataset]
              ) => ({

                id,

                ...dataset

              })
            )
            .sort(
              (
                a,
                b
              ) =>
                Number(
                  b.createdAt ||
                  0
                ) -
                Number(
                  a.createdAt ||
                  0
                )
            )


        setDatasets(
          list
        )

      }

      catch (err) {

        console.error(
          "Dataset load error:",
          err
        )


        setError(
          "データセットを取得できませんでした。"
        )

      }

      finally {

        setLoading(false)

      }

    }


  useEffect(() => {

    loadDatasets()

  }, [])


  // ========================================
  // 名前変更開始
  // ========================================

  const startEdit = (
    dataset
  ) => {

    setEditingId(
      dataset.id
    )

    setEditingName(
      dataset.name ||
      dataset.files?.[0]?.fileName ||
      ""
    )

  }


  // ========================================
  // 名前変更キャンセル
  // ========================================

  const cancelEdit = () => {

    setEditingId("")
    setEditingName("")

  }


  // ========================================
  // 名前変更保存
  // ========================================

  const saveName =
    async (
      datasetId
    ) => {

      const user =
        auth.currentUser


      if (!user) {

        setError(
          "Discordでログインしてください。"
        )

        return

      }


      const name =
        String(
          editingName || ""
        ).trim()


      if (!name) {

        setError(
          "ダイヤ名を入力してください。"
        )

        return

      }


      try {

        setSaving(true)
        setError("")


        await update(

          ref(
            database,
            `users/${user.uid}/datasets/${datasetId}`
          ),

          {

            name,

            updatedAt:
              Date.now()

          }

        )


        setDatasets(
          current =>
            current.map(
              dataset =>
                dataset.id ===
                  datasetId
                  ? {
                      ...dataset,
                      name,
                      updatedAt:
                        Date.now()
                    }
                  : dataset
            )
        )


        cancelEdit()

      }

      catch (err) {

        console.error(
          "Dataset rename error:",
          err
        )


        setError(
          `名前変更に失敗しました: ${err.message}`
        )

      }

      finally {

        setSaving(false)

      }

    }


  // ========================================
  // 削除
  // ========================================

  const deleteDataset =
    async (
      dataset
    ) => {

      const user =
        auth.currentUser


      if (!user) {

        setError(
          "Discordでログインしてください。"
        )

        return

      }


      const name =
        dataset.name ||
        dataset.files?.[0]?.fileName ||
        "名称未設定ダイヤ"


      const confirmed =
        window.confirm(
          `「${name}」を削除しますか？\n\nこのダイヤに属する列車データもすべて削除されます。\nこの操作は元に戻せません。`
        )


      if (!confirmed) {
        return
      }


      try {

        setSaving(true)
        setError("")


        /*
         * ====================================
         * 複数箇所を一括削除
         * ====================================
         */

        const root =
          `users/${user.uid}`


        const updates = {}


        // データセット本体
        updates[
          `${root}/datasets/${dataset.id}`
        ] = null


        // ==================================
        // そのDatasetの列車を探す
        // ==================================

        const trainsSnapshot =
          await get(
            ref(
              database,
              `${root}/trains`
            )
          )


        if (
          trainsSnapshot.exists()
        ) {

          const trains =
            trainsSnapshot.val()


          Object.entries(
            trains
          ).forEach(
            (
              [
                trainId,
                train
              ]
            ) => {

              if (
                train?.datasetId ===
                dataset.id
              ) {

                updates[
                  `${root}/trains/${trainId}`
                ] = null

              }

            }
          )

        }


        // ==================================
        // そのDatasetの路線も削除
        // ==================================

        const linesSnapshot =
          await get(
            ref(
              database,
              `${root}/lines`
            )
          )

        if (linesSnapshot.exists()) {

          const lines =
            linesSnapshot.val()

          Object.entries(lines).forEach(
            ([lineId, line]) => {

              if (
                line?.datasetId ===
                dataset.id
              ) {

                updates[
                  `${root}/lines/${lineId}`
                ] = null

              }

            }
          )

        }


        /*
         * ====================================
         * 一括反映
         * ====================================
         */

        await update(
          ref(
            database
          ),
          updates
        )


        /*
         * ====================================
         * 画面から削除
         * ====================================
         */

        setDatasets(
          current =>
            current.filter(
              item =>
                item.id !==
                dataset.id
            )
        )

        if (
          selectedDatasetId === dataset.id
        ) {

          await reloadDatasets()

        }

        else {

          await reloadDatasets(
            selectedDatasetId
          )

        }


      }

      catch (err) {

        console.error(
          "Dataset delete error:",
          err
        )


        setError(
          `ダイヤの削除に失敗しました: ${err.message}`
        )

      }

      finally {

        setSaving(false)

      }

    }


  // ========================================
  // Loading
  // ========================================

  if (loading) {

    return (

      <div>

        <h1>
          ダイヤ一覧
        </h1>


        <p>
          読み込み中...
        </p>

      </div>

    )

  }


  // ========================================
  // 表示
  // ========================================

  return (

    <div
      className="datasets-page"
    >

      <DatasetSelector />

      <div
        className="datasets-header"
      >

        <div>

          <h1>
            ダイヤ一覧
          </h1>


          <p>
            アップロードしたOUD2データを管理できます。
          </p>

        </div>


        <button
          type="button"
          onClick={() =>
            navigate(
              "/upload"
            )
          }
          disabled={saving}
        >

          OUD2を追加

        </button>

      </div>


      {error && (

        <div
          className="dataset-error"
        >

          {error}

        </div>

      )}


      {datasets.length === 0 ? (

        <div
          className="datasets-empty"
        >

          <p>
            まだダイヤデータがありません。
          </p>


          <button
            type="button"
            onClick={() =>
              navigate(
                "/upload"
              )
            }
          >

            OUD2をアップロード

          </button>

        </div>

      ) : (

        <div
          className="dataset-list"
        >

          {datasets.map(
            dataset => {

              const files =
                Array.isArray(
                  dataset.files
                )
                  ? dataset.files
                  : []


              const firstFile =
                files[0] || {}


              const isEditing =
                editingId ===
                dataset.id


              return (

                <div
                  key={
                    dataset.id
                  }

                  className="dataset-card"
                >

                  {isEditing ? (

                    <div
                      className="dataset-edit-area"
                    >

                      <input
                        type="text"
                        value={
                          editingName
                        }
                        onChange={event =>
                          setEditingName(
                            event.target.value
                          )
                        }
                        disabled={
                          saving
                        }
                        autoFocus
                      />


                      <div
                        className="dataset-edit-buttons"
                      >

                        <button
                          type="button"
                          onClick={() =>
                            saveName(
                              dataset.id
                            )
                          }
                          disabled={
                            saving
                          }
                        >

                          保存

                        </button>


                        <button
                          type="button"
                          onClick={
                            cancelEdit
                          }
                          disabled={
                            saving
                          }
                        >

                          キャンセル

                        </button>

                      </div>

                    </div>

                  ) : (

                    <>

                      <button
                        type="button"
                        className="dataset-card-main"
                        onClick={() => {
                          setSelectedDatasetId(
                            dataset.id
                          )

                          navigate(
                            `/trains?dataset=${encodeURIComponent(
                              dataset.id
                            )}`
                          )
                        }}
                        disabled={
                          saving
                        }
                      >

                        <h2>

                          {dataset.name ||
                            firstFile.fileName ||
                            "名称未設定ダイヤ"}

                        </h2>


                        <p>

                          {dataset.railwayName ||
                            firstFile.railwayName ||
                            "路線名未設定"}

                        </p>


                        <div
                          className="dataset-card-info"
                        >

                          <span>
                            {formatDate(
                              dataset.updatedAt ||
                              dataset.createdAt
                            )}
                          </span>


                          <span>
                            {dataset.fileCount ??
                              files.length}
                            {" ファイル"}
                          </span>


                          <span>
                            下り{" "}
                            {dataset.kudariCount ??
                              0}
                          </span>


                          <span>
                            上り{" "}
                            {dataset.noboriCount ??
                              0}
                          </span>

                        </div>

                      </button>


                      <div
                        className="dataset-card-actions"
                      >

                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/trains?dataset=${encodeURIComponent(
                                dataset.id
                              )}`
                            )
                          }
                          disabled={
                            saving
                          }
                        >

                          開く

                        </button>


                        <button
                          type="button"
                          onClick={() =>
                            startEdit(
                              dataset
                            )
                          }
                          disabled={
                            saving
                          }
                        >

                          名前変更

                        </button>


                        <button
                          type="button"
                          className="dataset-delete-button"
                          onClick={() =>
                            deleteDataset(
                              dataset
                            )
                          }
                          disabled={
                            saving
                          }
                        >

                          削除

                        </button>

                      </div>

                    </>

                  )}

                </div>

              )

            }
          )}

        </div>

      )}

    </div>

  )

}


export default Datasets
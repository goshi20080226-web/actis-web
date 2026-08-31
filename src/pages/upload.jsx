import {
  useState
} from "react"

import {
  useNavigate
} from "react-router-dom"

import {
  useDataset
} from "../context/DatasetContext"

import {
  ref,
  set
} from "firebase/database"

import {
  onAuthStateChanged
} from "firebase/auth"

import {
  database,
  auth
} from "../firebase/config"

import parseOud2 from "../parser/oud2Parser"


function getCurrentUser() {

  return new Promise(
    (
      resolve
    ) => {

      if (
        auth.currentUser
      ) {

        resolve(
          auth.currentUser
        )

        return

      }


      const unsubscribe =
        onAuthStateChanged(
          auth,
          user => {

            unsubscribe()

            resolve(
              user
            )

          }
        )

    }
  )

}


function Upload() {

  const navigate = useNavigate()

  const {
    setSelectedDatasetId,
    reloadDatasets
  } = useDataset()

  const [
    files,
    setFiles
  ] =
    useState([])


  const [
    datasets,
    setDatasets
  ] =
    useState([])


  const [
    message,
    setMessage
  ] =
    useState("")


  const [
    uploading,
    setUploading
  ] =
    useState(false)


  // ========================================
  // OUD2読み込み
  // ========================================

  const handleFiles =
    async event => {

      const selectedFiles =
        Array.from(
          event.target.files || []
        )


      const oud2Files =
        selectedFiles.filter(
          file =>
            file.name
              .toLowerCase()
              .endsWith(".oud2")
        )


      if (
        oud2Files.length === 0
      ) {

        setFiles([])
        setDatasets([])

        setMessage(
          "OUD2ファイルを選択してください。"
        )

        return

      }


      setMessage(
        `${oud2Files.length}件のOUD2を解析中...`
      )


      const parsed = []


      for (
        const file of oud2Files
      ) {

        try {

          const text =
            await file.text()


          const data =
            parseOud2(
              text,
              file.name
            )


          parsed.push(
            data
          )

        }

        catch (
          error
        ) {

          console.error(
            `OUD2解析エラー: ${file.name}`,
            error
          )

        }

      }


      setFiles(
        oud2Files
      )


      setDatasets(
        parsed
      )


      setMessage(
        `${parsed.length}件のOUD2を読み込みました`
      )

    }


  // ========================================
  // Firebaseアップロード
  // ========================================

  const uploadToFirebase =
    async () => {

      if (
        datasets.length === 0
      ) {

        setMessage(
          "先にOUD2ファイルを選択してください。"
        )

        return

      }


      try {

        setUploading(
          true
        )

        setMessage(
          "Firebaseへアップロード中..."
        )


        const user =
          await getCurrentUser()


        if (
          !user
        ) {

          throw new Error(
            "ACTISアカウントにログインしてください。"
          )

        }


        const uid =
          user.uid


        /*
         * ==================================
         * Dataset ID
         * ==================================
         */

        const datasetId =
          `dataset_${Date.now()}`


        /*
         * ==================================
         * Dataset
         * ==================================
         */

        await set(

          ref(
            database,
            `users/${uid}/datasets/${datasetId}`
          ),

          {

            files:
              datasets,

            uploadedAt:
              Date.now(),

            uploadedBy:
              uid

          }

        )


        /*
         * ==================================
         * 列車
         * ==================================
         */

        const trainData = {}


        let trainCount =
          0


        for (
          const dataset
          of datasets
        ) {

          for (
            const direction
            of [
              "Kudari",
              "Nobori"
            ]
          ) {

            const trains =
              dataset
                ?.trains
                ?.[
                  direction
                ] || []


            for (
              const train
              of trains
            ) {

              if (
                !train?.trainNo
              ) {

                continue

              }


              const trainId =

                `${datasetId}_${direction}_${train.trainNo}`


              const nextTrainNo =

                train.nextTrain?.trainNo ||
                train.nextTrainNo ||
                null


              const previousTrainNo =

                train.previousTrain?.trainNo ||
                train.previousTrainNo ||
                null


              const trainForFirebase = {

                ...train,

                trainId,

                datasetId,

                sourceFile:
                  dataset.fileName,

                direction,

                unyo:
                  train.unyo ||
                  null,

                operationSequence:
                  train.operationSequence ||
                  null,

                operationLength:
                  train.operationLength ||
                  null,

                nextTrainNo,

                previousTrainNo,

                operationTurnback:
                  train.operationTurnback ||
                  null

              }


              /*
               * 循環参照防止
               */

              delete
                trainForFirebase.nextTrain


              delete
                trainForFirebase.previousTrain


              trainData[
                trainId
              ] =
                trainForFirebase


              trainCount++

            }

          }

        }


        /*
         * ==================================
         * trains
         * ==================================
         */

        await set(

          ref(
            database,
            `users/${uid}/trains`
          ),

          trainData

        )


        /*
         * ==================================
         * 路線データ
         * ==================================
         */

        const lineData = {}


        for (
          const dataset
          of datasets
        ) {

          const stations =
            Array.isArray(
              dataset?.stations
            )
              ? dataset.stations
              : []


          const railwayName =
            dataset?.railwayName ||
            dataset?.fileName ||
            "路線"


          const lineKey =
            String(
              railwayName
            )
              .replace(
                /[.#$/[\]]/g,
                "_"
              )


          lineData[
            lineKey
          ] = {

            name:
              railwayName,

            fileName:
              dataset?.fileName ||
              "",

            stations,

            railwayName:
              dataset?.railwayName ||
              "",

            downAlias:
              dataset?.downAlias ||
              "",

            upAlias:
              dataset?.upAlias ||
              "",

            datasetId,

            updatedAt:
              Date.now()

          }

        }


        await set(

          ref(
            database,
            `users/${uid}/lines`
          ),

          lineData

        )


        /*
         * ==================================
         * 完了
         * ==================================
         */

        setMessage(

          `アップロード完了：${trainCount}列車`

        )

        // 新しく作成したデータセットを全体の選択状態へ反映
        setSelectedDatasetId(datasetId)
        await reloadDatasets(datasetId)

        // そのデータセットの列車一覧へ自動移動
        navigate(
          `/trains?dataset=${encodeURIComponent(datasetId)}`,
          { replace: true }
        )

      }

      catch (
        error
      ) {

        console.error(
          "Firebase upload error:",
          error
        )


        setMessage(
          `アップロードに失敗しました：${error.message}`
        )

      }

      finally {

        setUploading(
          false
        )

      }

    }


  return (

    <div>

      <h1>
        OUD2アップロード
      </h1>


      <div>

        <input
          type="file"
          accept=".oud2"
          multiple
          onChange={
            handleFiles
          }
          disabled={
            uploading
          }
        />

      </div>


      {files.length > 0 && (

        <div>

          <p>
            読み込みファイル：
            {files.length}
            件
          </p>


          {datasets.map(
            (
              data,
              index
            ) => (

              <div
                key={
                  index
                }

                style={{
                  marginTop:
                    "10px",

                  padding:
                    "10px",

                  border:
                    "1px solid #ccc",

                  background:
                    "#fff"
                }}
              >

                <h3>
                  {
                    data.fileName ||
                    "OUD2"
                  }
                </h3>


                <p>
                  路線名：
                  {
                    data.railwayName ||
                    "不明"
                  }
                </p>


                <p>
                  駅数：
                  {
                    data.stations?.length ||
                    0
                  }
                </p>


                <p>
                  下り：
                  {
                    data.trains?.Kudari?.length ||
                    0
                  }
                </p>


                <p>
                  上り：
                  {
                    data.trains?.Nobori?.length ||
                    0
                  }
                </p>

              </div>

            )
          )}

        </div>

      )}


      <button
        type="button"
        onClick={
          uploadToFirebase
        }
        disabled={
          uploading ||
          datasets.length === 0
        }
      >

        {
          uploading
            ? "アップロード中..."
            : "Firebaseへアップロード"
        }

      </button>


      {message && (

        <p>
          {message}
        </p>

      )}

    </div>

  )

}


export default Upload

import {
  useEffect,
  useState
} from "react"

import {
  ref,
  get
} from "firebase/database"

import {
  onAuthStateChanged
} from "firebase/auth"

import DatasetSelector from "../components/dataset/DatasetSelector"

import {
  useDataset
} from "../context/DatasetContext"

import {
  auth,
  database
} from "../firebase/config"


function getCurrentUser() {

  return new Promise(
    resolve => {

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


function Lines() {

  const [
    lines,
    setLines
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


  useEffect(() => {

    let cancelled =
      false


    const loadLines =
      async () => {

        try {

          setLoading(
            true
          )

          setError("")


          const user =
            await getCurrentUser()


          if (
            !user
          ) {

            setError(
              "ACTISアカウントにログインしてください。"
            )

            return

          }


          /*
           * ==================================
           * 自分の路線データのみ
           * ==================================
           */

          const snapshot =
            await get(

              ref(
                database,
                `users/${user.uid}/lines`
              )

            )


          if (
            cancelled
          ) {

            return

          }


          if (
            !snapshot.exists()
          ) {

            setLines([])

            return

          }


          const data =
            snapshot.val()


          /*
           * Firebase Object
           * → Array
           */

          const list =
            Object.entries(
              data || {}
            ).map(
              (
                [id, line]
              ) => ({

                id,

                ...line

              })
            )


          if (
            !cancelled
          ) {

            setLines(
              selectedDatasetId
                ? list.filter(
                    line =>
                      String(
                        line.datasetId || ""
                      ) ===
                      String(
                        selectedDatasetId
                      )
                  )
                : []
            )

          }

        }

        catch (
          err
        ) {

          console.error(
            "Lines load error:",
            err
          )


          if (
            !cancelled
          ) {

            setError(
              `路線データを取得できませんでした：${err.message}`
            )

          }

        }

        finally {

          if (
            !cancelled
          ) {

            setLoading(
              false
            )

          }

        }

      }


    loadLines()


    return () => {

      cancelled =
        true

    }

  }, [selectedDatasetId])


  /*
   * ========================================
   * Loading
   * ========================================
   */

  if (
    loading
  ) {

    return (

      <div
        className="lines-page"
      >

        <h1>
          路線一覧
        </h1>

        <p>
          読み込み中...
        </p>

      </div>

    )

  }


  /*
   * ========================================
   * Error
   * ========================================
   */

  if (
    error
  ) {

    return (

      <div
        className="lines-page"
      >

        <h1>
          路線一覧
        </h1>

        <p>
          {error}
        </p>

      </div>

    )

  }


  /*
   * ========================================
   * 表示
   * ========================================
   */

  return (

    <div
      className="lines-page"
    >

      <DatasetSelector />

      <div
        className="lines-header"
      >

        <div>

          <h1>
            路線一覧
          </h1>

          <p>
            自分がアップロードした
            OUD2データの路線を表示します。
          </p>

        </div>


        <div>

          <strong>
            {lines.length}
          </strong>

          <span>
            路線
          </span>

        </div>

      </div>


      {lines.length === 0 ? (

        <div
          className="lines-empty"
        >

          <p>
            路線データがありません。
          </p>

          <p>
            OUD2をアップロードすると
            ここに表示されます。
          </p>

        </div>

      ) : (

        <div
          className="lines-list"
        >

          {lines.map(
            line => {

              const stations =
                Array.isArray(
                  line.stations
                )
                  ? line.stations
                  : []


              return (

                <div
                  key={
                    line.id
                  }

                  className="line-card"
                >

                  <div
                    className="line-card-header"
                  >

                    <h2>
                      {
                        line.name ||
                        line.railwayName ||
                        "路線"
                      }
                    </h2>

                  </div>


                  <div
                    className="line-card-body"
                  >

                    <div>

                      <span>
                        ファイル
                      </span>

                      <strong>
                        {
                          line.fileName ||
                          "—"
                        }
                      </strong>

                    </div>


                    <div>

                      <span>
                        駅数
                      </span>

                      <strong>
                        {
                          stations.length
                        }
                      </strong>

                    </div>


                    {line.downAlias && (

                      <div>

                        <span>
                          下り略称
                        </span>

                        <strong>
                          {
                            line.downAlias
                          }
                        </strong>

                      </div>

                    )}


                    {line.upAlias && (

                      <div>

                        <span>
                          上り略称
                        </span>

                        <strong>
                          {
                            line.upAlias
                          }
                        </strong>

                      </div>

                    )}

                  </div>


                  <div
                    className="line-stations"
                  >

                    {stations.map(
                      (
                        station,
                        index
                      ) => (

                        <span
                          key={
                            index
                          }
                        >

                          {
                            station?.name ||
                            station?.Ekimei ||
                            ""
                          }

                        </span>

                      )
                    )}

                  </div>

                </div>

              )

            }
          )}

        </div>

      )}

    </div>

  )

}


export default Lines

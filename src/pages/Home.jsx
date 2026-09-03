import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import DatasetSelector from "../components/dataset/DatasetSelector"
import { useDataset } from "../context/DatasetContext"

const quickLinks = [
  {
    label: "OUD2アップロード",
    path: "/upload",
    description: "新しいダイヤデータを追加",
  },
  {
    label: "ダイヤ管理",
    path: "/datasets",
    description: "選択・名前変更・削除",
  },
  {
    label: "運用一覧",
    path: "/trains",
    description: "列車と運用を確認",
  },
  {
    label: "旅客時刻表",
    path: "/timetable",
    description: "駅ごとの発車時刻を表示",
  },
]

function formatDatasetName(dataset) {
  if (!dataset) {
    return "データセット未選択"
  }

  return dataset.name || dataset.fileName || dataset.railwayName || dataset.id
}

function Home() {
  const navigate = useNavigate()

  const {
    datasets,
    selectedDataset,
    selectedDatasetId,
    loading,
  } = useDataset()

  const stats = useMemo(() => {
    const files = Array.isArray(selectedDataset?.files)
      ? selectedDataset.files
      : []

    const firstFile = files[0] || {}

    return [
      {
        label: "登録ダイヤ",
        value: String(datasets.length),
        tone: "green",
      },
      {
        label: "選択中ファイル",
        value: selectedDataset ? String(files.length || 1) : "0",
        tone: "blue",
      },
      {
        label: "下り列車",
        value: String(selectedDataset?.kudariCount ?? firstFile?.trains?.Kudari?.length ?? 0),
        tone: "amber",
      },
      {
        label: "上り列車",
        value: String(selectedDataset?.noboriCount ?? firstFile?.trains?.Nobori?.length ?? 0),
        tone: "red",
      },
    ]
  }, [datasets.length, selectedDataset])

  return (
    <div className="home-page">
      <header className="page-hero">
        <div>
          <p className="eyebrow">ACTIS Dashboard</p>
          <h1>運行管理ダッシュボード</h1>
          <p>
            OUD2アップロード、データセット選択、運用一覧、スタフ表示を同じデータセット基準で扱います。
          </p>
        </div>

        <div className="hero-actions">
          <DatasetSelector />
          <button type="button" onClick={() => navigate("/upload")}>
            OUD2を追加
          </button>
        </div>
      </header>

      <section className="status-grid" aria-label="データセット概要">
        {stats.map((stat) => (
          <article className={`status-card ${stat.tone}`} key={stat.label}>
            <p>{stat.label}</p>
            <strong>{loading ? "..." : stat.value}</strong>
          </article>
        ))}
      </section>

      <section className="work-area">
        <article className="panel wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Current Dataset</p>
              <h2>{formatDatasetName(selectedDataset)}</h2>
            </div>
            <button type="button" onClick={() => navigate("/datasets")}>
              管理
            </button>
          </div>

          <div className="dataset-summary">
            {selectedDatasetId ? (
              <>
                <div>
                  <span>Dataset ID</span>
                  <strong>{selectedDatasetId}</strong>
                </div>
                <div>
                  <span>路線</span>
                  <strong>{selectedDataset?.railwayName || "未設定"}</strong>
                </div>
                <div>
                  <span>更新</span>
                  <strong>
                    {selectedDataset?.updatedAt || selectedDataset?.uploadedAt || selectedDataset?.createdAt
                      ? new Date(
                          selectedDataset.updatedAt ||
                          selectedDataset.uploadedAt ||
                          selectedDataset.createdAt
                        ).toLocaleString("ja-JP")
                      : "未記録"}
                  </strong>
                </div>
              </>
            ) : (
              <p className="empty-message">
                まだ選択中のデータセットがありません。OUD2をアップロードするとACTIS全体で参照できます。
              </p>
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Workflow</p>
              <h2>運営手順</h2>
            </div>
          </div>

          <ol className="workflow-list">
            <li>OUD2をアップロード</li>
            <li>作成されたDatasetを選択</li>
            <li>運用・スタフ・時刻表を確認</li>
            <li>不要なDatasetを管理画面で整理</li>
          </ol>
        </article>
      </section>

      <section className="quick-grid" aria-label="主要機能">
        {quickLinks.map((link) => (
          <button
            className="quick-card"
            key={link.path}
            type="button"
            onClick={() => navigate(link.path)}
          >
            <strong>{link.label}</strong>
            <span>{link.description}</span>
          </button>
        ))}
      </section>
    </div>
  )
}

export default Home

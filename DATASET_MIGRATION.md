ACTIS Dataset単位化 基盤

追加ファイル

src/context/DatasetContext.jsx
src/components/dataset/DatasetSelector.jsx
src/utils/dataset.js

目的

ACTIS全体で「現在選択中のデータセット」を共通利用するための基盤です。

現在のFirebase構造は既存実装に合わせて datasets/{datasetId} を利用します。
アップロード処理では datasetId が生成され、datasets/{datasetId} に files が保存され、
列車にも datasetId が付与されています。

App.jsx

BrowserRouter の内側でも外側でも構いませんが、アプリ全体を DatasetProvider で包みます。

例:

<DatasetProvider>
  <BrowserRouter>
    ...
  </BrowserRouter>
</DatasetProvider>

各ページで:

import { useDataset } from "../context/DatasetContext"

const {
  selectedDataset,
  selectedDatasetId
} = useDataset()

として現在のデータセットを取得します。

共通セレクタ:

import DatasetSelector from "../components/dataset/DatasetSelector"

ページ上部などに

<DatasetSelector />

を配置します。

重要

現在のTrains/Staff/Timetable/Lines等は一部が users/{uid}/trains や
users/{uid}/lines を直接読んでいるため、完全なデータセット単位化には
各ページの読み込み処理を selectedDatasetId でフィルタする必要があります。

列車データの場合:

const visibleTrains =
  trains.filter(
    train =>
      train.datasetId === selectedDatasetId
  )

という形にします。

この基盤は既存データを削除・移動しません。

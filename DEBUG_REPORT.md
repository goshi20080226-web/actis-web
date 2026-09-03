# ACTIS-Web デバッグ修正

今回のアップロード版を基準に、既存機能を壊さない範囲で確認・修正しました。

## 確認
- src 配下の JS/JSX/TS/TSX を TypeScript の構文パーサーで検査
- 結果: 構文エラー 0 件
- 相対 import の参照先を確認
- 結果: 解決不能な相対 import 0 件

## 修正
- App.jsx の実ファイル名と合わない import (`Upload`, `Trains`, `Login`) を修正
- ダイヤ管理の「開く」ボタンでも対象 Dataset を選択するよう修正
- URL の `?dataset=...` を DatasetContext が認識するよう修正
  - アップロード後や管理画面からの遷移時に対象 Dataset を維持
- 既存の Dataset 単位フィルタ、旅客用時刻表、スタフ、運用表示は保持

## 注意
この環境では依存パッケージの完全な Vite 本番ビルドは実行できませんでした。
`vite/client` / `node` の型定義がローカルに存在しないため、`tsc -b` は開始時点で停止します。
そのため、構文・import 解決を中心に検証しています。

## 既存仕様として維持
- スタフの秒表示
- 旅客用時刻表は分まで
- 旅客用時刻表は発時刻順
- 種別色は OUD2 の JikokuhyouMojiColor を元に利用
- 行先は EkimeiJikokuRyaku / timeName を優先
- Dataset を選択して列車・スタフ・時刻表・路線を切り替える
- OUD2 アップロード後は作成した Dataset を選択し、列車一覧へ移動
- Dataset 管理画面から選択・名前変更・削除

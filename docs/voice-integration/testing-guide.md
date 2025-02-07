# 音声認識・テキスト読み上げ機能 動作確認ガイド

## 1. テスト環境のセットアップ

### 1.1 VOICEVOXのインストール
1. [VOICEVOX公式サイト](https://voicevox.hiroshiba.jp/)からVOICEVOXをダウンロード
2. インストーラーを実行し、指示に従ってインストール
3. VOICEVOXを起動し、エンジンが正常に動作することを確認
   - 起動後、http://localhost:50021/docs にアクセスしてSwagger UIが表示されることを確認
   - 確認コマンド: `curl http://localhost:50021/version`

### 1.2 開発環境の準備
```bash
# 依存パッケージのインストール
npm install

# TypeScriptのビルド
npm run compile

# 拡張機能のパッケージング
npm run package
```

### 1.3 マイクの設定
1. システム設定でマイクの権限を確認
2. ブラウザでマイクのテスト
   - Chrome: chrome://settings/content/microphone
   - Edge: edge://settings/content/microphone

## 2. 動作確認手順

### 2.1 基本機能の確認

1. VOICEVOXの起動確認
```bash
# バージョン確認
curl http://localhost:50021/version

# 簡単な音声合成テスト
curl -X POST "http://localhost:50021/audio_query?text=こんにちは&speaker=1" > query.json
curl -X POST "http://localhost:50021/synthesis?speaker=1" -H "Content-Type: application/json" -d @query.json > test.wav
```

2. VSCode拡張機能の起動
   - F5キーで拡張機能をデバッグモードで起動
   - ステータスバーに音声認識アイコンが表示されることを確認

3. 音声認識の確認
   - ステータスバーの音声認識アイコンをクリック
   - マイクの使用許可ダイアログが表示されることを確認
   - 許可後、アイコンが変化することを確認

4. 基本的な音声コマンドのテスト
   ```
   テストコマンド例:
   - 「ファイルを開いて」
   - 「保存して」
   - 「ヘルプ」
   ```

### 2.2 詳細テスト項目

1. 音声認識の精度
   - 静かな環境での認識率
   - ノイズがある環境での認識率
   - 異なる話者での認識率

2. 音声合成の品質
   - 文章の自然さ
   - 音声の明瞭さ
   - レイテンシー

3. エラー処理
   - マイク未接続時の動作
   - VOICEVOXエンジン停止時の動作
   - ネットワークエラー時の動作

## 3. トラブルシューティング

### 3.1 音声認識の問題

1. マイクが認識されない場合
   - システム設定でマイクが有効になっているか確認
   - ブラウザの権限設定を確認
   - 別のマイクデバイスを試す

2. 認識精度が低い場合
   - マイクの位置や向きを調整
   - 周囲のノイズを低減
   - マイクの音量レベルを確認

3. 音声認識が開始されない場合
```bash
# デバッグログの確認
code --log-level=debug
```

### 3.2 VOICEVOXの問題

1. 音声合成が失敗する場合
```bash
# VOICEVOXのログを確認
tail -f ~/.config/voicevox/voicevox.log

# エンドポイントの疎通確認
curl http://localhost:50021/speakers
```

2. 音声が再生されない場合
   - システムの音声出力設定を確認
   - 別の音声出力デバイスを試す
   - AudioContextの状態を確認

3. レイテンシーが高い場合
   - VOICEVOXの設定を調整
   - キャッシュの活用を確認
   - ネットワーク接続を確認

### 3.3 一般的なエラー対処

1. VSCodeの開発者ツール
   - `Ctrl+Shift+P` → `Developer: Toggle Developer Tools`
   - コンソールログでエラーを確認

2. エラーログの確認
```bash
# VSCodeのログ
code --log-level=debug

# 拡張機能のログ
tail -f ~/.vscode/extensions/saoudrizwan.claude-dev-*/logs/extension.log
```

3. クリーンアップと再インストール
```bash
# キャッシュのクリア
rm -rf ~/.vscode/extensions/saoudrizwan.claude-dev-*
npm cache clean --force

# 再インストール
npm install
npm run package
```

## 4. パフォーマンス最適化

### 4.1 メモリ使用量の監視
```bash
# VSCodeのプロセスを監視
top -pid $(pgrep -f "code")

# VOICEVOXのプロセスを監視
top -pid $(pgrep -f "voicevox")
```

### 4.2 ネットワーク使用量の確認
```bash
# ネットワークトラフィックの監視
sudo tcpdump -i any port 50021
```

### 4.3 CPU使用率の最適化
- 音声認識の連続処理時間を制限
- 音声合成のキャッシュを活用
- バックグラウンド処理の最適化

## 5. テスト結果の記録

### 5.1 テストレポートのテンプレート
```markdown
# テスト実行日時: YYYY-MM-DD HH:MM
## 環境情報
- OS: 
- VSCode バージョン:
- VOICEVOX バージョン:
- マイクデバイス:

## テスト結果
1. 音声認識
   - 認識率: %
   - 平均レイテンシー: ms
   - エラー発生回数:

2. 音声合成
   - 品質評価: /5
   - 平均合成時間: ms
   - エラー発生回数:

## 発見された問題
1. 
2. 
3. 

## 改善提案
1. 
2. 
3. 
```

### 5.2 継続的なモニタリング
- 定期的なパフォーマンステスト
- エラーログの分析
- ユーザーフィードバックの収集

## 6. 次のステップ

### 6.1 機能改善の提案
- カスタムコマンドの追加
- 話者バリエーションの拡充
- エラー通知の改善

### 6.2 パフォーマンス改善
- キャッシュ戦略の最適化
- 並列処理の導入
- メモリ使用量の最適化
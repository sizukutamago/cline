# 音声認識初期化エラーのトラブルシューティングガイド

## 1. エラーの診断

### 1.1 エラーログの確認
```bash
# VSCodeのデバッグログを有効化
code --log-level=debug

# 拡張機能のログを確認
tail -f ~/.vscode/extensions/saoudrizwan.claude-dev-*/logs/extension.log
```

### 1.2 一般的なエラーパターン

1. マイクアクセスエラー
```typescript
// エラーメッセージ例
VoiceRecognitionError: マイクの使用が許可されていません
code: VoiceRecognitionErrorCode.NOT_ALLOWED
```

2. Web Speech API非対応
```typescript
// エラーメッセージ例
Error: このブラウザは音声認識をサポートしていません
```

3. VOICEVOXエンジン接続エラー
```typescript
// エラーメッセージ例
VoicevoxError: VOICEVOXサービスとの通信に失敗しました
statusCode: 500
```

## 2. 環境チェックリスト

### 2.1 システム要件
- OS: macOS Sequoia以降
- メモリ: 8GB以上推奨
- ディスク空き容量: 1GB以上
- ネットワーク: 安定したインターネット接続

### 2.2 必要なソフトウェア
- Node.js: v18以上
- VSCode: 1.84.0以上
- VOICEVOX: 最新版
- Webブラウザ: Chrome/Edge最新版

### 2.3 権限設定
1. マイクの権限
   - システム環境設定 > セキュリティとプライバシー > マイク
   - VSCodeにマイクの使用を許可

2. ネットワークアクセス
   - ファイアウォール設定でVOICEVOXとVSCodeの通信を許可
   - ポート50021の開放確認

## 3. 初期化エラーの対処手順

### 3.1 マイクアクセスエラーの場合

1. マイク権限の確認
```bash
# macOSの場合
ls -l /dev/audio*
ls -l /dev/input/by-id/*usb-*
```

2. マイクデバイスのテスト
```bash
# オーディオデバイスの一覧
system_profiler SPAudioDataType

# マイク入力レベルの確認
osascript -e "get volume settings"
```

3. ブラウザ設定の確認
- chrome://settings/content/microphone
- マイクのブロック解除
- デフォルトデバイスの選択

### 3.2 Web Speech API関連の問題

1. ブラウザの確認
```javascript
// 開発者ツールで実行
if ('webkitSpeechRecognition' in window) {
    console.log('Web Speech API サポート: OK');
} else {
    console.log('Web Speech API サポート: NG');
}
```

2. 代替ブラウザの試用
- Chrome最新版
- Edge最新版
- Firefox最新版(一部機能制限あり)

### 3.3 VOICEVOXエンジンの問題

1. サービス状態の確認
```bash
# エンドポイントの疎通確認
curl http://localhost:50021/version

# プロセスの確認
ps aux | grep voicevox
```

2. ポート競合の確認
```bash
# ポート使用状況
lsof -i :50021

# 別のポートでの起動テスト
export VOICEVOX_PORT=50022
```

3. エンジンの再起動
```bash
# プロセスの終了
pkill -f voicevox

# エンジンの再起動
open -a VOICEVOX
```

## 4. クリーンアップと再インストール

### 4.1 拡張機能のクリーンアップ
```bash
# 拡張機能の削除
rm -rf ~/.vscode/extensions/saoudrizwan.claude-dev-*

# キャッシュのクリア
rm -rf ~/.vscode/CachedExtensions
```

### 4.2 開発環境の再構築
```bash
# 依存関係のクリーンアップ
rm -rf node_modules
npm cache clean --force

# 再インストール
npm install
npm run compile
npm run package
```

### 4.3 VOICEVOXの再インストール
1. 既存のVOICEVOXをアンインストール
2. 設定ファイルの削除
```bash
rm -rf ~/.config/voicevox
```
3. 最新版のVOICEVOXをインストール

## 5. 動作確認

### 5.1 段階的な機能確認

1. 基本機能
```bash
# VOICEVOXの動作確認
curl http://localhost:50021/speakers

# マイクの認識確認
navigator.mediaDevices.getUserMedia({ audio: true })
```

2. 音声認識テスト
```typescript
const recognition = new webkitSpeechRecognition();
recognition.lang = 'ja-JP';
recognition.onresult = (event) => {
    console.log(event.results[0][0].transcript);
};
recognition.start();
```

3. 音声合成テスト
```bash
# 簡単なテストフレーズの合成
curl -X POST "http://localhost:50021/audio_query?text=テスト&speaker=1" > query.json
curl -X POST "http://localhost:50021/synthesis?speaker=1" -H "Content-Type: application/json" -d @query.json > test.wav
```

### 5.2 統合テスト
1. VSCode拡張機能の起動
2. ステータスバーアイコンの確認
3. 音声認識の開始/停止
4. 簡単なコマンドテスト

## 6. 予防措置

### 6.1 定期的なメンテナンス
- ログファイルの定期的なクリーンアップ
- 未使用のキャッシュの削除
- システムリソースの監視

### 6.2 バックアップと復元
- 設定のバックアップ
- カスタマイズした音声モデルの保存
- 重要なログの保管

### 6.3 パフォーマンス最適化
- 不要なバックグラウンドプロセスの終了
- システムリソースの最適化
- ネットワーク設定の調整

## 7. サポート情報

### 7.1 ログの収集
```bash
# 全てのログを収集
mkdir -p ~/voice-debug-logs
cp ~/.vscode/extensions/saoudrizwan.claude-dev-*/logs/* ~/voice-debug-logs/
cp ~/.config/voicevox/voicevox.log ~/voice-debug-logs/
```

### 7.2 システム情報の収集
```bash
# システム情報
system_profiler SPHardwareDataType > ~/voice-debug-logs/system-info.txt
system_profiler SPAudioDataType > ~/voice-debug-logs/audio-info.txt
```

### 7.3 エラーレポートの作成
```markdown
## エラー報告テンプレート

### 環境情報
- OS バージョン:
- VSCode バージョン:
- VOICEVOX バージョン:
- Node.js バージョン:

### エラーの詳細
- エラーメッセージ:
- 発生状況:
- 再現手順:

### 試した対処法
1. 
2. 
3. 

### 添付ファイル
- デバッグログ
- システム情報
- スクリーンショット
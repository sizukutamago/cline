# マイク権限エラーのトラブルシューティングガイド

## エラーの概要

`not-allowed` エラーは以下の状況で発生します:

1. マイクへのアクセス権限が明示的に拒否されている
2. HTTPS接続が必要な環境でHTTPを使用している
3. WebViewのコンテキストでマイク権限が正しく設定されていない

## 解決手順

### 1. VSCode設定の確認

1. VSCodeの設定を開く(Command+,)
2. "WebView" で検索
3. 以下の設定を確認:
   ```json
   {
     "webview.experimental.useExternalEndpoint": true
   }
   ```

### 2. マイク権限の確認

#### macOSの場合:

1. システム環境設定 > セキュリティとプライバシー > プライバシー > マイク
2. VSCodeにチェックが入っていることを確認
3. チェックがない場合は追加

```bash
# ターミナルでの権限確認
tccutil reset Microphone
```

#### Windowsの場合:

1. 設定 > プライバシー > マイク
2. 「アプリがマイクにアクセスできるようにする」をオン
3. VSCodeのアクセスを許可

### 3. WebView実装の修正

```typescript
// WebViewVoiceService.ts の修正点

private createWebViewPanel(): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'voiceRecognition',
    '音声認識',
    vscode.ViewColumn.Two,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      // 以下を追加
      localResourceRoots: [],
      enableFindWidget: false
    }
  );

  // Content Security Policyの追加
  const nonce = this.getNonce();
  panel.webview.html = this.getWebViewContent(nonce);
  return panel;
}

private getWebViewContent(nonce: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" 
              content="default-src 'none'; 
                      script-src 'nonce-${nonce}';
                      media-src 'self' https: mediastream:;">
        <title>音声認識</title>
      </head>
      <body>
        <div id="status">音声認識の準備中...</div>
        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          
          // 権限チェックを追加
          async function checkPermission() {
            try {
              const result = await navigator.permissions.query({ name: 'microphone' });
              if (result.state === 'denied') {
                vscode.postMessage({
                  type: 'error',
                  error: 'マイクの使用が許可されていません。システム設定で許可してください。'
                });
                return false;
              }
              return true;
            } catch (error) {
              console.error('権限チェックエラー:', error);
              return false;
            }
          }

          // 初期化前に権限チェック
          async function initRecognition() {
            const hasPermission = await checkPermission();
            if (!hasPermission) return;

            if (!('webkitSpeechRecognition' in window)) {
              vscode.postMessage({
                type: 'error',
                error: 'このブラウザは音声認識をサポートしていません'
              });
              return;
            }

            try {
              // マイクアクセスのテスト
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              stream.getTracks().forEach(track => track.stop());

              // 音声認識の初期化
              recognition = new webkitSpeechRecognition();
              recognition.lang = 'ja-JP';
              recognition.continuous = true;
              recognition.interimResults = false;

              // イベントハンドラの設定
              setupRecognitionHandlers();
            } catch (error) {
              vscode.postMessage({
                type: 'error',
                error: 'マイクの初期化に失敗しました: ' + error.message
              });
            }
          }

          function setupRecognitionHandlers() {
            recognition.onstart = () => {
              document.getElementById('status').textContent = '音声認識: 実行中';
              document.getElementById('status').className = 'active';
            };

            recognition.onerror = (event) => {
              console.error('音声認識エラー:', event.error);
              vscode.postMessage({
                type: 'error',
                error: event.error
              });
            };

            recognition.onend = () => {
              document.getElementById('status').textContent = '音声認識: 停止中';
              document.getElementById('status').className = 'inactive';
            };
          }

          // 初期化の実行
          initRecognition();
        </script>
      </body>
    </html>
  `;
}

private getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
```

### 4. エラーハンドリングの改善

```typescript
// VoiceManager.ts での対応

private async handleError(error: any): void {
  if (error instanceof VoiceRecognitionError && 
      error.code === VoiceRecognitionErrorCode.NOT_ALLOWED) {
    
    const action = await vscode.window.showErrorMessage(
      'マイクの使用が許可されていません。システム設定を開きますか?',
      '設定を開く',
      'キャンセル'
    );

    if (action === '設定を開く') {
      if (process.platform === 'darwin') {
        // macOSの場合
        await vscode.commands.executeCommand(
          'vscode.open',
          vscode.Uri.parse('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone')
        );
      } else if (process.platform === 'win32') {
        // Windowsの場合
        await vscode.commands.executeCommand(
          'vscode.open',
          vscode.Uri.parse('ms-settings:privacy-microphone')
        );
      }
    }
  }
  // その他のエラー処理...
}
```

### 5. 動作確認手順

1. VSCodeを再起動
2. 音声認識を開始する前に:
   - システム設定でマイク権限を確認
   - WebViewのコンソールでエラーメッセージを確認
   - ネットワーク接続を確認

3. トラブルシューティング:
   ```bash
   # マイク権限の再設定(macOS)
   tccutil reset Microphone
   
   # VSCodeの設定リセット
   rm -rf ~/Library/Application\ Support/Code/User/settings.json
   ```

### 6. 既知の制限事項

1. Electron/WebViewの制限により、一部の環境では追加の設定が必要
2. HTTPSが必要な環境での使用制限
3. システムレベルのマイク権限が必要

### 7. 推奨設定

```json
// settings.json
{
  "webview.experimental.useExternalEndpoint": true,
  "security.workspace.trust.enabled": true,
  "security.workspace.trust.untrustedFiles": "open"
}
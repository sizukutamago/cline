import * as vscode from "vscode"
import { VoiceRecognitionService, VoiceRecognitionError, VoiceRecognitionErrorCode } from "./types"
import { MacPermissionManager } from "./MacPermissionManager"

/**
 * WebViewを使用した音声認識サービス
 */
export class WebViewVoiceService implements VoiceRecognitionService {
	private webview: vscode.Webview | null = null
	private panel: vscode.WebviewPanel | null = null
	private resultCallback: ((text: string) => void) | null = null
	private errorCallback: ((error: VoiceRecognitionError) => void) | null = null
	private outputChannel: vscode.OutputChannel

	constructor(private readonly context: vscode.ExtensionContext) {
		this.outputChannel = vscode.window.createOutputChannel("Voice Recognition")
	}

	/**
	 * WebViewパネルを作成
	 */
	private async createWebViewPanel(): Promise<vscode.WebviewPanel> {
		const panel = vscode.window.createWebviewPanel("voiceRecognition", "音声認識", vscode.ViewColumn.Two, {
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [],
		})

		const nonce = this.getNonce()
		panel.webview.html = this.getWebViewContent(nonce)
		this.setupWebViewMessageHandling(panel.webview)

		this.panel = panel
		this.webview = panel.webview

		panel.onDidDispose(() => {
			this.panel = null
			this.webview = null
		})

		return panel
	}

	/**
	 * WebViewのHTMLコンテンツを生成
	 */
	private getWebViewContent(nonce: string): string {
		return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Security-Policy" 
                content="default-src 'none'; 
                        script-src 'nonce-${nonce}';
                        style-src 'unsafe-inline';
                        media-src mediastream: https:;">
          <title>音声認識</title>
          <style>
            body {
              padding: 20px;
              font-family: sans-serif;
            }
            .status {
              margin-bottom: 20px;
              padding: 10px;
              border-radius: 4px;
            }
            .active {
              background-color: #e6ffe6;
              color: #006600;
            }
            .inactive {
              background-color: #ffe6e6;
              color: #660000;
            }
            .error {
              background-color: #ffe6e6;
              color: #660000;
              padding: 10px;
              margin-top: 10px;
              border-radius: 4px;
            }
            .button {
              padding: 10px 20px;
              border-radius: 4px;
              border: none;
              background-color: #007acc;
              color: white;
              cursor: pointer;
              margin-bottom: 20px;
            }
            .button:hover {
              background-color: #005999;
            }
          </style>
        </head>
        <body>
          <div id="status" class="status inactive">音声認識: 準備中...</div>
          <div id="error" class="error" style="display: none;"></div>
          <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            let recognition = null;
            let audioContext = null;
            let mediaStream = null;

            async function initializeVoiceRecognition() {
              try {
                // マイクへのアクセスを試行
                mediaStream = await navigator.mediaDevices.getUserMedia({ 
                  audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                  }
                });

                // オーディオコンテキストの初期化
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                // 音声認識の初期化と開始
                await initRecognition();
                if (recognition) {
                  recognition.start();
                }
              } catch (error) {
                console.error('Voice recognition initialization error:', error);
                vscode.postMessage({
                  type: 'error',
                  error: error.message || 'マイクの初期化に失敗しました'
                });
              }
            }

            function showError(message) {
              const errorDiv = document.getElementById('error');
              errorDiv.textContent = message;
              errorDiv.style.display = 'block';
              vscode.postMessage({
                type: 'error',
                error: message
              });
            }

            async function checkMicrophonePermission() {
              try {
                // マイクへのアクセスを試行
                mediaStream = await navigator.mediaDevices.getUserMedia({ 
                  audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                  }
                });

                // マイクアクセスが成功したら音声認識を初期化
                document.getElementById('permissionStatus').style.display = 'none';
                await initAudio();
                await initRecognition();
                if (recognition) {
                  recognition.start();
                }
              } catch (error) {
                console.error('Permission check error:', error);
                if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                  document.getElementById('permissionStatus').style.display = 'block';
                  showError('マイクの使用が許可されていません。システム設定でマイクの使用を許可してください。');
                } else {
                  showError('マイクの初期化に失敗しました: ' + error.message);
                }
                vscode.postMessage({
                  type: 'error',
                  error: error.message
                });
              }
            }

            async function initAudio() {
              try {
                // オーディオコンテキストの初期化
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                return true;
              } catch (error) {
                console.error('Audio initialization error:', error);
                showError(error.message || 'マイクの初期化に失敗しました');
                return false;
              }
            }

            async function initRecognition() {
              if (!('webkitSpeechRecognition' in window)) {
                showError('このブラウザは音声認識をサポートしていません');
                return;
              }

              recognition = new webkitSpeechRecognition();
              recognition.lang = 'ja-JP';
              recognition.continuous = true;
              recognition.interimResults = false;

              recognition.onstart = () => {
                document.getElementById('status').textContent = '音声認識: 実行中';
                document.getElementById('status').className = 'status active';
                document.getElementById('error').style.display = 'none';
                vscode.postMessage({ type: 'status', status: 'started' });
              };

              recognition.onresult = (event) => {
                const text = event.results[event.results.length - 1][0].transcript;
                if (text) {
                  vscode.postMessage({
                    type: 'result',
                    text: text
                  });
                }
              };

              recognition.onerror = (event) => {
                console.error('Recognition error:', event.error);
                showError(getErrorMessage(event.error));
              };

              recognition.onend = () => {
                document.getElementById('status').textContent = '音声認識: 停止中';
                document.getElementById('status').className = 'status inactive';
                vscode.postMessage({ type: 'status', status: 'stopped' });
              };
            }

            function getErrorMessage(error) {
              switch (error) {
                case 'no-speech':
                  return '音声が検出されませんでした';
                case 'audio-capture':
                  return 'マイクにアクセスできません';
                case 'not-allowed':
                  return 'マイクの使用が許可されていません';
                case 'network':
                  return 'ネットワークエラーが発生しました';
                case 'bad-grammar':
                  return '文法エラーが発生しました';
                case 'language-not-supported':
                  return '指定された言語はサポートされていません';
                default:
                  return '音声認識エラーが発生しました: ' + error;
              }
            }

            function cleanup() {
              if (recognition) {
                recognition.stop();
              }
              if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
              }
              if (audioContext) {
                audioContext.close();
              }
            }

            // メッセージハンドラーの設定
            window.addEventListener('message', async event => {
              const message = event.data;
              switch (message.command) {
                case 'start':
                  await initializeVoiceRecognition();
                  break;
                case 'stop':
                  cleanup();
                  break;
              }
            });

            window.addEventListener('unload', cleanup);
          </script>
        </body>
      </html>
    `
	}

	/**
	 * WebViewのメッセージハンドリングを設定
	 */
	private setupWebViewMessageHandling(webview: vscode.Webview): void {
		webview.onDidReceiveMessage(
			(message) => {
				switch (message.type) {
					case "result":
						if (this.resultCallback) {
							this.resultCallback(message.text)
						}
						break
					case "error":
						if (this.errorCallback) {
							if (message.error === "Canceled") {
								return
							}
							const error = new VoiceRecognitionError(message.error, this.mapErrorCode(message.error))
							this.errorCallback(error)
						}
						this.outputChannel.appendLine(`音声認識エラー: ${message.error}`)
						break
					case "status":
						this.outputChannel.appendLine(`音声認識状態: ${message.status}`)
						break
				}
			},
			undefined,
			this.context.subscriptions,
		)
	}

	/**
	 * エラーコードのマッピング
	 */
	private mapErrorCode(error: string): VoiceRecognitionErrorCode {
		if (error.includes("許可されていません")) {
			return VoiceRecognitionErrorCode.NOT_ALLOWED
		}
		if (error.includes("検出されませんでした")) {
			return VoiceRecognitionErrorCode.NO_SPEECH
		}
		if (error.includes("アクセスできません")) {
			return VoiceRecognitionErrorCode.AUDIO_CAPTURE
		}
		if (error.includes("ネットワーク")) {
			return VoiceRecognitionErrorCode.NETWORK
		}
		if (error.includes("文法")) {
			return VoiceRecognitionErrorCode.BAD_GRAMMAR
		}
		if (error.includes("言語")) {
			return VoiceRecognitionErrorCode.LANGUAGE_NOT_SUPPORTED
		}
		return VoiceRecognitionErrorCode.NOT_ALLOWED
	}

	/**
	 * ランダムなnonceを生成
	 */
	private getNonce(): string {
		let text = ""
		const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length))
		}
		return text
	}

	/**
	 * 音声認識を開始
	 */
	async startListening(): Promise<void> {
		this.outputChannel.appendLine("音声認識を開始します...")

		try {
			// マイク権限の確認
			const hasPermission = await MacPermissionManager.checkMicrophonePermission()
			if (!hasPermission) {
				// マイク権限がない場合、システム設定を開くように促す
				const action = await vscode.window.showErrorMessage(
					"マイクの使用が許可されていません。システム設定でマイクの使用を許可してください。",
					"システム設定を開く",
					"キャンセル",
				)

				if (action === "システム設定を開く") {
					await MacPermissionManager.openSystemPreferences()
				}
				// キャンセルまたはダイアログを閉じた場合は静かに終了
				return
			}

			if (!this.webview) {
				await this.createWebViewPanel()
			}

			this.webview?.postMessage({ command: "start" })
		} catch (error) {
			// キャンセルエラーは無視
			if (error instanceof Error && error.message === "Canceled") {
				return
			}

			if (error instanceof VoiceRecognitionError) {
				throw error
			}

			throw new VoiceRecognitionError("マイクの初期化に失敗しました", VoiceRecognitionErrorCode.AUDIO_CAPTURE)
		}
	}

	/**
	 * 音声認識を停止
	 */
	stopListening(): void {
		this.outputChannel.appendLine("音声認識を停止します...")
		this.webview?.postMessage({ command: "stop" })
	}

	/**
	 * 音声認識結果のコールバックを設定
	 */
	onResult(callback: (text: string) => void): void {
		this.resultCallback = callback
	}

	/**
	 * エラーハンドリングのコールバックを設定
	 */
	onError(callback: (error: VoiceRecognitionError) => void): void {
		this.errorCallback = callback
	}

	/**
	 * リソースの解放
	 */
	dispose(): void {
		this.stopListening()
		if (this.panel) {
			this.panel.dispose()
		}
		this.outputChannel.dispose()
	}
}

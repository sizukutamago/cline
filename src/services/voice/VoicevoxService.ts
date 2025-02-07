import * as vscode from "vscode"
import { VoiceSynthesisService, VoicevoxConfig, VoicevoxError } from "./types"

/**
 * VOICEVOXを使用した音声合成サービスの実装
 */
export class VoicevoxService implements VoiceSynthesisService {
	private readonly apiEndpoint: string
	private readonly speakerId: number
	private webview: vscode.Webview | null = null
	private panel: vscode.WebviewPanel | null = null

	constructor(config: VoicevoxConfig) {
		this.apiEndpoint = config.apiEndpoint
		this.speakerId = config.speakerId
	}

	/**
	 * WebViewパネルを作成
	 */
	private createWebViewPanel(): vscode.WebviewPanel {
		this.panel = vscode.window.createWebviewPanel("voicevoxPlayer", "音声再生", vscode.ViewColumn.Two, {
			enableScripts: true,
			retainContextWhenHidden: true,
		})

		this.panel.webview.html = this.getWebViewContent()
		this.webview = this.panel.webview

		this.panel.onDidDispose(() => {
			this.panel = null
			this.webview = null
		})

		return this.panel
	}

	/**
	 * WebViewのHTMLコンテンツを生成
	 */
	private getWebViewContent(): string {
		return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>音声再生</title>
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
            .playing {
              background-color: #e6ffe6;
              color: #006600;
            }
            .stopped {
              background-color: #ffe6e6;
              color: #660000;
            }
          </style>
        </head>
        <body>
          <div id="status" class="status stopped">音声再生: 停止中</div>
          <audio id="player"></audio>
          <script>
            const vscode = acquireVsCodeApi();
            const player = document.getElementById('player');
            const status = document.getElementById('status');

            player.onplay = () => {
              status.textContent = '音声再生: 再生中';
              status.className = 'status playing';
            };

            player.onended = () => {
              status.textContent = '音声再生: 停止中';
              status.className = 'status stopped';
              vscode.postMessage({ type: 'playbackComplete' });
            };

            window.addEventListener('message', event => {
              const message = event.data;
              if (message.type === 'play') {
                const audioData = message.audioData;
                const blob = new Blob([audioData], { type: 'audio/wav' });
                const url = URL.createObjectURL(blob);
                player.src = url;
                player.play().catch(error => {
                  vscode.postMessage({ 
                    type: 'error',
                    error: error.message
                  });
                });
              }
            });
          </script>
        </body>
      </html>
    `
	}

	/**
	 * テキストを音声に変換
	 */
	async synthesize(text: string): Promise<ArrayBuffer> {
		try {
			// 1. 音声合成用のクエリを生成
			const queryResponse = await fetch(
				`${this.apiEndpoint}/audio_query?text=${encodeURIComponent(text)}&speaker=${this.speakerId}`,
				{ method: "POST" },
			)

			if (!queryResponse.ok) {
				throw new VoicevoxError("クエリの生成に失敗しました", queryResponse.status)
			}

			const queryJson = await queryResponse.json()

			// 2. 音声合成を実行
			const synthesisResponse = await fetch(`${this.apiEndpoint}/synthesis?speaker=${this.speakerId}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(queryJson),
			})

			if (!synthesisResponse.ok) {
				throw new VoicevoxError("音声合成に失敗しました", synthesisResponse.status)
			}

			return synthesisResponse.arrayBuffer()
		} catch (error) {
			if (error instanceof VoicevoxError) {
				throw error
			}
			throw new VoicevoxError("VOICEVOXサービスとの通信に失敗しました", 500)
		}
	}

	/**
	 * 音声を再生
	 */
	async speak(audioData: ArrayBuffer): Promise<void> {
		if (!this.webview) {
			this.createWebViewPanel()
		}

		return new Promise((resolve, reject) => {
			if (!this.webview) {
				reject(new Error("WebViewの初期化に失敗しました"))
				return
			}

			// メッセージハンドラーを設定
			const messageListener = this.webview.onDidReceiveMessage((message) => {
				switch (message.type) {
					case "playbackComplete":
						messageListener.dispose()
						resolve()
						break
					case "error":
						messageListener.dispose()
						reject(new Error(message.error))
						break
				}
			})

			// 音声データを送信
			this.webview.postMessage({
				type: "play",
				audioData: Array.from(new Uint8Array(audioData)),
			})
		})
	}

	/**
	 * リソースの解放
	 */
	dispose(): void {
		if (this.panel) {
			this.panel.dispose()
			this.panel = null
			this.webview = null
		}
	}
}

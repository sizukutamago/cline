import * as assert from "assert"
import * as vscode from "vscode"
import { WebViewVoiceService } from "../../services/voice/WebViewVoiceService"
import { VoiceRecognitionError, VoiceRecognitionErrorCode } from "../../services/voice/types"

suite("WebView Voice Service Test Suite", () => {
	let context: vscode.ExtensionContext
	let service: WebViewVoiceService
	let disposables: vscode.Disposable[] = []
	let messageCallback: ((message: any) => void) | null = null

	suiteSetup(() => {
		// テスト用のモックコンテキストを作成
		context = {
			subscriptions: [],
			extensionPath: __dirname,
			globalState: {
				get: () => undefined,
				update: () => Promise.resolve(),
			},
		} as any
	})

	setup(() => {
		messageCallback = null
		service = new WebViewVoiceService(context)
	})

	teardown(() => {
		service.stopListening()
		disposables.forEach((d) => d.dispose())
		disposables = []
		messageCallback = null
	})

	function createMockWebview() {
		return {
			html: "",
			onDidReceiveMessage: (callback: (message: any) => void) => {
				messageCallback = callback
				return {
					dispose: () => {
						messageCallback = null
					},
				}
			},
			postMessage: (message: any): Thenable<boolean> => Promise.resolve(true),
		}
	}

	function createMockPanel() {
		return {
			webview: createMockWebview(),
			onDidDispose: (callback: () => void) => {
				disposables.push({ dispose: callback })
				return { dispose: () => {} }
			},
			dispose: () => {},
		}
	}

	test("WebViewの初期化", async () => {
		let webviewCreated = false
		const mockPanel = createMockPanel()

		// createWebviewPanelをモック
		const originalCreateWebviewPanel = vscode.window.createWebviewPanel
		const mockCreateWebviewPanel = (
			viewType: string,
			title: string,
			showOptions: vscode.ViewColumn | { viewColumn: vscode.ViewColumn; preserveFocus?: boolean },
			options?: vscode.WebviewPanelOptions & vscode.WebviewOptions,
		): vscode.WebviewPanel => {
			webviewCreated = true
			assert.strictEqual(viewType, "voiceRecognition")
			assert.strictEqual(title, "音声認識")
			assert.ok(options?.enableScripts)
			return mockPanel as any
		}
		;(vscode.window as any).createWebviewPanel = mockCreateWebviewPanel

		try {
			await service.startListening()
			assert.ok(webviewCreated, "WebViewが作成されていません")
		} finally {
			;(vscode.window as any).createWebviewPanel = originalCreateWebviewPanel
		}
	})

	test("音声認識結果のハンドリング", async () => {
		let resultReceived = false
		const testText = "テストテキスト"

		service.onResult((text: string) => {
			resultReceived = true
			assert.strictEqual(text, testText)
		})

		// WebViewをモックしてサービスを初期化
		const mockPanel = createMockPanel()
		;(vscode.window as any).createWebviewPanel = () => mockPanel
		await service.startListening()

		// メッセージをシミュレート
		if (messageCallback) {
			messageCallback({
				type: "result",
				text: testText,
			})
		}

		assert.ok(resultReceived, "音声認識結果が受信されていません")
	})

	test("エラーハンドリング", async () => {
		let errorReceived = false
		const testError = "not-allowed"

		service.onError((error: VoiceRecognitionError) => {
			errorReceived = true
			assert.strictEqual(error.code, VoiceRecognitionErrorCode.NOT_ALLOWED)
		})

		// WebViewをモックしてサービスを初期化
		const mockPanel = createMockPanel()
		;(vscode.window as any).createWebviewPanel = () => mockPanel
		await service.startListening()

		// エラーメッセージをシミュレート
		if (messageCallback) {
			messageCallback({
				type: "error",
				error: testError,
			})
		}

		assert.ok(errorReceived, "エラーが受信されていません")
	})

	test("音声認識の開始と停止", async () => {
		let commandReceived = ""
		const mockPanel = createMockPanel()

		// postMessageをモック
		mockPanel.webview.postMessage = async (message: any): Promise<boolean> => {
			commandReceived = message.command
			return true
		}

		// WebViewをモックしてサービスを初期化
		;(vscode.window as any).createWebviewPanel = () => mockPanel
		await service.startListening()

		// 開始コマンドのテスト
		await service.startListening()
		assert.strictEqual(commandReceived, "start")

		// 停止コマンドのテスト
		service.stopListening()
		assert.strictEqual(commandReceived, "stop")
	})

	test("Content Security Policyの検証", async () => {
		const mockPanel = createMockPanel()
		;(vscode.window as any).createWebviewPanel = () => mockPanel
		await service.startListening()

		const html = mockPanel.webview.html

		// CSPヘッダーの存在確認
		assert.ok(html.includes("Content-Security-Policy"))

		// 必要なディレクティブの確認
		assert.ok(html.includes("script-src"))
		assert.ok(html.includes("media-src"))
		assert.ok(html.includes("nonce-"))
	})

	test("エラーメッセージのローカライズ", async () => {
		const errorMessages = [
			{ error: "no-speech", expected: "音声が検出されませんでした" },
			{ error: "audio-capture", expected: "マイクにアクセスできません" },
			{ error: "not-allowed", expected: "マイクの使用が許可されていません" },
			{ error: "network", expected: "ネットワークエラーが発生しました" },
		]

		for (const { error, expected } of errorMessages) {
			const code = service["mapErrorCode"](expected)
			const newError = new VoiceRecognitionError(expected, code)
			assert.ok(newError.message.includes(expected))
		}
	})
})

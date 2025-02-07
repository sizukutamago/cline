import * as assert from "assert"
import * as vscode from "vscode"
import { WebViewVoiceService } from "../../services/voice/WebViewVoiceService"
import { VoicevoxService } from "../../services/voice/VoicevoxService"
import { ClineVoiceCommandHandler } from "../../services/voice/ClineVoiceCommandHandler"
import { VoiceManager } from "../../services/voice/VoiceManager"
import { VoiceMonitor } from "../../services/voice/VoiceMonitor"
import { VoiceRecognitionError, VoicevoxError, VoiceRecognitionErrorCode } from "../../services/voice/types"

suite("Voice Integration Test Suite", () => {
	let context: vscode.ExtensionContext
	let disposables: vscode.Disposable[] = []

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

	suiteTeardown(() => {
		disposables.forEach((d) => d.dispose())
	})

	test("VoiceManager - 初期化と状態管理", () => {
		const manager = new VoiceManager(context)
		disposables.push(manager)

		// ステータスバーアイテムの確認
		assert.ok(manager["statusBarItem"])
		assert.strictEqual(manager["isActive"], false)
	})

	test("VoicevoxService - テキストから音声合成", async () => {
		const service = new VoicevoxService({
			apiEndpoint: "http://localhost:50021",
			speakerId: 1,
		})

		try {
			const audioData = await service.synthesize("こんにちは")
			assert.ok(audioData instanceof ArrayBuffer)
			assert.ok(audioData.byteLength > 0)
		} catch (error) {
			// VOICEVOXサーバーが起動していない場合はスキップ
			if (error instanceof VoicevoxError && error.statusCode === 500) {
				console.log("VOICEVOXサービスが利用できないためテストをスキップします")
				return
			}
			throw error
		}
	})

	test("WebViewVoiceService - 音声認識の初期化", async () => {
		const service = new WebViewVoiceService(context)
		let resultReceived = false

		service.onResult((text: string) => {
			resultReceived = true
			assert.ok(text.length > 0)
		})

		try {
			await service.startListening()
			assert.ok(service["webview"], "WebViewが初期化されていません")
		} finally {
			service.stopListening()
		}
	})

	test("VoiceMonitor - エラー監視とヘルスチェック", async () => {
		const monitor = new VoiceMonitor(context)
		disposables.push(monitor)

		// エラーログの記録
		const testError = new VoiceRecognitionError("テストエラー", VoiceRecognitionErrorCode.NOT_ALLOWED)
		monitor.logError(testError)

		// ヘルスチェック
		const health = await monitor.checkHealth()
		assert.ok(typeof health === "boolean")
	})

	test("ClineVoiceCommandHandler - コマンド処理", async () => {
		const mockVoiceSynthesis = {
			synthesize: async () => new ArrayBuffer(0),
			speak: async () => {},
		}

		const handler = new ClineVoiceCommandHandler(mockVoiceSynthesis, context)

		// 基本的なコマンドのテスト
		const testCases = [
			{
				input: "ファイルを開いて",
				expectedContains: ["開", "ファイル"],
			},
			{
				input: "保存して",
				expectedContains: ["保存"],
			},
			{
				input: "ヘルプを表示",
				expectedContains: ["ヘルプ"],
			},
		]

		for (const { input, expectedContains } of testCases) {
			const response = await handler.handleCommand(input)
			assert.ok(typeof response === "string")
			for (const expected of expectedContains) {
				assert.ok(response.includes(expected), `応答 "${response}" に "${expected}" が含まれていません`)
			}
		}
	})

	test("音声認識と合成の統合テスト", async () => {
		const manager = new VoiceManager(context)
		disposables.push(manager)

		try {
			// 音声認識の開始
			await manager.toggleVoiceRecognition()
			assert.strictEqual(manager["isActive"], true)

			// 少し待機して音声認識の状態を確認
			await new Promise((resolve) => setTimeout(resolve, 1000))

			// 音声認識の停止
			await manager.toggleVoiceRecognition()
			assert.strictEqual(manager["isActive"], false)
		} catch (error) {
			assert.fail(`統合テストが失敗しました: ${error.message}`)
		}
	})

	test("エラーハンドリングの検証", () => {
		const monitor = new VoiceMonitor(context)
		disposables.push(monitor)

		// 音声認識エラー
		const recognitionError = new VoiceRecognitionError("マイクアクセスエラー", VoiceRecognitionErrorCode.NOT_ALLOWED)
		monitor.logError(recognitionError)

		// VOICEVOX エラー
		const voicevoxError = new VoicevoxError("音声合成エラー", 500)
		monitor.logError(voicevoxError)

		// エラーカウントの確認
		assert.ok(monitor["errorCounts"].has("VoiceRecognitionError"))
		assert.ok(monitor["errorCounts"].has("VoicevoxError"))
	})
})

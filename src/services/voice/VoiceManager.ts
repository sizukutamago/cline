import * as vscode from "vscode"
import { WebViewVoiceService } from "./WebViewVoiceService"
import { VoicevoxService } from "./VoicevoxService"
import { ClineVoiceCommandHandler } from "./ClineVoiceCommandHandler"
import { VoiceRecognitionError, VoicevoxError, VoiceRecognitionErrorCode } from "./types"
import { VoiceMonitor } from "./VoiceMonitor"
import { MacPermissionManager } from "./MacPermissionManager"

/**
 * 音声機能全体を管理するマネージャークラス
 */
export class VoiceManager {
	private recognitionService: WebViewVoiceService
	private synthesisService: VoicevoxService
	private commandHandler: ClineVoiceCommandHandler
	private monitor: VoiceMonitor
	private statusBarItem: vscode.StatusBarItem
	private isActive: boolean = false
	private outputChannel: vscode.OutputChannel

	constructor(context: vscode.ExtensionContext) {
		this.outputChannel = vscode.window.createOutputChannel("Voice Manager")

		// VOICEVOXの設定
		this.synthesisService = new VoicevoxService({
			apiEndpoint: "http://localhost:50021",
			speakerId: 1,
		})

		// 音声認識サービスの初期化
		this.recognitionService = new WebViewVoiceService(context)

		// コマンドハンドラーの初期化
		this.commandHandler = new ClineVoiceCommandHandler(this.synthesisService, context)

		// モニタリングシステムの初期化
		this.monitor = new VoiceMonitor(context)

		// ステータスバーアイテムの初期化
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
		this.statusBarItem.text = "$(unmute) 音声認識: オフ"
		this.statusBarItem.command = "cline.toggleVoiceRecognition"
		this.statusBarItem.show()

		// イベントハンドラーの設定
		this.setupEventHandlers()

		// マイク権限の監視を開始
		if (process.platform === "darwin") {
			this.watchMacPermissions()
		}
	}

	/**
	 * マイク権限の監視(macOS)
	 */
	private async watchMacPermissions(): Promise<void> {
		await MacPermissionManager.watchPermissionChanges((hasPermission) => {
			if (!hasPermission && this.isActive) {
				// 権限が失われた場合は音声認識を停止
				this.stop()
				vscode.window.showWarningMessage("マイクの使用権限が失われたため、音声認識を停止しました。")
			}
		})
	}

	/**
	 * 音声認識の開始/停止を切り替え
	 */
	async toggleVoiceRecognition(): Promise<void> {
		try {
			if (this.isActive) {
				await this.stop()
			} else {
				await this.start()
			}
		} catch (error) {
			this.handleError(error)
		}
	}

	/**
	 * 音声認識を開始
	 */
	private async start(): Promise<void> {
		try {
			this.outputChannel.appendLine("音声認識の開始を試みます...")

			// システムの健全性チェック
			const isHealthy = await this.monitor.checkHealth()
			if (!isHealthy) {
				throw new Error("システムの状態が不安定です")
			}

			// macOSの場合、マイク権限を確認
			if (process.platform === "darwin") {
				this.outputChannel.appendLine("マイク権限の確認中...")
				const hasPermission = await MacPermissionManager.requestMicrophonePermission()
				if (!hasPermission) {
					// キャンセルされた場合は静かに終了
					this.outputChannel.appendLine("マイク権限の要求がキャンセルされました")
					return
				}
			}

			await this.recognitionService.startListening()
			this.isActive = true
			this.statusBarItem.text = "$(megaphone) 音声認識: オン"
			this.outputChannel.appendLine("音声認識を開始しました")
			vscode.window.showInformationMessage("音声認識を開始しました")
		} catch (error) {
			this.handleError(error)
		}
	}

	/**
	 * 音声認識を停止
	 */
	private async stop(): Promise<void> {
		this.outputChannel.appendLine("音声認識を停止します...")
		this.recognitionService.stopListening()
		this.isActive = false
		this.statusBarItem.text = "$(unmute) 音声認識: オフ"
		this.outputChannel.appendLine("音声認識を停止しました")
		vscode.window.showInformationMessage("音声認識を停止しました")
	}

	/**
	 * イベントハンドラーの設定
	 */
	private setupEventHandlers(): void {
		// 音声認識結果のハンドリング
		this.recognitionService.onResult(async (text: string) => {
			try {
				this.outputChannel.appendLine(`音声認識結果: ${text}`)
				// コマンドの処理
				const response = await this.commandHandler.handleCommand(text)

				// 音声フィードバック
				await this.commandHandler.provideFeedback(response)
			} catch (error) {
				this.handleError(error)
			}
		})

		// 音声認識エラーのハンドリング
		this.recognitionService.onError((error: VoiceRecognitionError) => {
			this.handleError(error)
		})
	}

	/**
	 * エラー処理
	 */
	private async handleError(error: any): Promise<void> {
		// エラーをモニタリングシステムに記録
		this.monitor.logError(error)

		let message: string
		if (error instanceof VoiceRecognitionError) {
			message = `音声認識エラー: ${error.message}`
			this.outputChannel.appendLine(`音声認識エラー: ${error.message} (${error.code})`)
			this.stop() // エラー時は音声認識を停止

			// macOSでマイク権限エラーの場合
			if (process.platform === "darwin" && error.code === VoiceRecognitionErrorCode.NOT_ALLOWED) {
				await MacPermissionManager.showPermissionHelp()
			}
		} else if (error instanceof VoicevoxError) {
			message = `音声合成エラー: ${error.message}`
			this.outputChannel.appendLine(`音声合成エラー: ${error.message} (${error.statusCode})`)
		} else {
			message = `エラーが発生しました: ${error.message || error}`
			this.outputChannel.appendLine(`予期せぬエラー: ${error}`)
		}

		// キャンセルエラーの場合は通知を表示しない
		if (!message.includes("Canceled")) {
			vscode.window.showErrorMessage(message)
		}
		console.error("VoiceManager エラー:", error)
	}

	/**
	 * 設定の更新
	 */
	updateSettings(settings: any): void {
		this.outputChannel.appendLine("設定を更新します...")
		if (settings.voicevoxEndpoint) {
			this.synthesisService = new VoicevoxService({
				apiEndpoint: settings.voicevoxEndpoint,
				speakerId: settings.voicevoxSpeakerId || 1,
			})
			this.outputChannel.appendLine("VOICEVOXの設定を更新しました")
		}
	}

	/**
	 * リソースの解放
	 */
	dispose(): void {
		this.outputChannel.appendLine("リソースを解放します...")
		this.stop()
		this.statusBarItem.dispose()
		this.synthesisService.dispose()
		this.monitor.dispose()
		this.outputChannel.dispose()
	}

	/**
	 * VSCode拡張機能のコマンド登録
	 */
	registerCommands(context: vscode.ExtensionContext): void {
		context.subscriptions.push(
			vscode.commands.registerCommand("cline.toggleVoiceRecognition", this.toggleVoiceRecognition.bind(this)),
		)
	}
}

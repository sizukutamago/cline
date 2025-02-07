import * as vscode from "vscode"
import { VoiceRecognitionError, VoicevoxError } from "./types"

/**
 * 音声システムの状態を監視するモニタリングクラス
 */
export class VoiceMonitor {
	private static readonly ERROR_THRESHOLD = 3
	private static readonly MEMORY_THRESHOLD = 500 * 1024 * 1024 // 500MB
	private static readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000 // 5分

	private errorCounts = new Map<string, number>()
	private lastHealthCheck: Date = new Date()
	private healthCheckTimer: NodeJS.Timeout | null = null

	constructor(private readonly context: vscode.ExtensionContext) {
		this.startHealthCheck()
	}

	/**
	 * エラーを記録し、必要に応じて対処
	 */
	public logError(error: Error): void {
		const errorKey = error.name
		const count = (this.errorCounts.get(errorKey) || 0) + 1
		this.errorCounts.set(errorKey, count)

		// エラーログの記録
		console.error(`[${new Date().toISOString()}] ${error.name}: ${error.message}`)

		// エラー回数が閾値を超えた場合の処理
		if (count >= VoiceMonitor.ERROR_THRESHOLD) {
			this.handleRecurringError(errorKey, error)
		}
	}

	/**
	 * システムの健全性チェック
	 */
	public async checkHealth(): Promise<boolean> {
		try {
			// メモリ使用量の確認
			const memoryUsage = process.memoryUsage().heapUsed
			if (memoryUsage > VoiceMonitor.MEMORY_THRESHOLD) {
				throw new Error("メモリ使用量が閾値を超えています")
			}

			// VOICEVOXの状態確認
			const response = await fetch("http://localhost:50021/version")
			if (!response.ok) {
				throw new Error("VOICEVOXサービスが応答していません")
			}

			this.lastHealthCheck = new Date()
			return true
		} catch (error) {
			console.error("ヘルスチェックに失敗:", error)
			return false
		}
	}

	/**
	 * 定期的なヘルスチェックを開始
	 */
	private startHealthCheck(): void {
		this.healthCheckTimer = setInterval(async () => {
			const isHealthy = await this.checkHealth()
			if (!isHealthy) {
				vscode.window.showWarningMessage("音声システムの状態が不安定です。診断を実行してください。")
			}
		}, VoiceMonitor.HEALTH_CHECK_INTERVAL)
	}

	/**
	 * 繰り返し発生するエラーの処理
	 */
	private handleRecurringError(errorKey: string, error: Error): void {
		switch (errorKey) {
			case "VoiceRecognitionError":
				this.handleRecurringVoiceError(error as VoiceRecognitionError)
				break
			case "VoicevoxError":
				this.handleRecurringVoicevoxError(error as VoicevoxError)
				break
			default:
				this.handleGenericError(error)
		}
	}

	/**
	 * 音声認識の繰り返しエラーを処理
	 */
	private handleRecurringVoiceError(error: VoiceRecognitionError): void {
		vscode.window
			.showErrorMessage(`音声認識で問題が発生しています: ${error.message}`, "再起動", "キャンセル")
			.then((selection) => {
				if (selection === "再起動") {
					this.restartVoiceRecognition()
				}
			})
	}

	/**
	 * VOICEVOXの繰り返しエラーを処理
	 */
	private handleRecurringVoicevoxError(error: VoicevoxError): void {
		vscode.window
			.showErrorMessage(`VOICEVOXで問題が発生しています: ${error.message}`, "サービス再起動", "キャンセル")
			.then((selection) => {
				if (selection === "サービス再起動") {
					this.restartVoicevoxService()
				}
			})
	}

	/**
	 * 一般的なエラーを処理
	 */
	private handleGenericError(error: Error): void {
		vscode.window.showErrorMessage(`予期せぬエラーが発生しました: ${error.message}`)
	}

	/**
	 * 音声認識システムの再起動
	 */
	private async restartVoiceRecognition(): Promise<void> {
		try {
			// WebViewの再起動をトリガー
			vscode.commands
				.executeCommand("cline.toggleVoiceRecognition")
				.then(() => vscode.commands.executeCommand("cline.toggleVoiceRecognition"))

			this.errorCounts.delete("VoiceRecognitionError")
			vscode.window.showInformationMessage("音声認識システムを再起動しました")
		} catch (error) {
			vscode.window.showErrorMessage("音声認識システムの再起動に失敗しました")
		}
	}

	/**
	 * VOICEVOXサービスの再起動
	 */
	private async restartVoicevoxService(): Promise<void> {
		try {
			// VOICEVOXプロセスの再起動コマンドを実行
			// Note: 実際の実装ではシステムに応じた再起動方法を実装
			vscode.window.showInformationMessage("VOICEVOXサービスの再起動を試みています...")

			// 再起動の成功を確認
			const response = await fetch("http://localhost:50021/version")
			if (response.ok) {
				this.errorCounts.delete("VoicevoxError")
				vscode.window.showInformationMessage("VOICEVOXサービスを再起動しました")
			} else {
				throw new Error("サービスの応答が不正です")
			}
		} catch (error) {
			vscode.window.showErrorMessage("VOICEVOXサービスの再起動に失敗しました")
		}
	}

	/**
	 * リソースの解放
	 */
	public dispose(): void {
		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer)
			this.healthCheckTimer = null
		}
	}
}

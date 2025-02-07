import * as vscode from "vscode"
import { VoiceCommandHandler } from "./types"
import { VoiceSynthesisService } from "./types"

/**
 * Clineと音声機能を統合するハンドラー
 */
export class ClineVoiceCommandHandler implements VoiceCommandHandler {
	constructor(
		private readonly voiceSynthesis: VoiceSynthesisService,
		private readonly context: vscode.ExtensionContext,
	) {}

	/**
	 * 音声コマンドを処理
	 * @param command 音声コマンド
	 * @returns 処理結果のメッセージ
	 */
	async handleCommand(command: string): Promise<string> {
		try {
			// コマンドの前処理
			const processedCommand = this.preprocessCommand(command)

			// Clineにコマンドを送信
			// Note: 実際のCline APIの呼び出し方法に応じて実装を調整
			const response = await this.executeClineCommand(processedCommand)

			return response
		} catch (error) {
			console.error("音声コマンド処理エラー:", error)
			return "コマンドの実行中にエラーが発生しました"
		}
	}

	/**
	 * コマンドの前処理
	 * @param command 生の音声コマンド
	 * @returns 処理済みコマンド
	 */
	private preprocessCommand(command: string): string {
		// 1. 不要な空白の削除
		let processed = command.trim()

		// 2. 句読点の正規化
		processed = processed.replace(/[、。]/g, "")

		// 3. 一般的な音声認識エラーの修正
		const corrections: { [key: string]: string } = {
			ファイルをひらいて: "ファイルを開いて",
			せーぶ: "セーブ",
			ほぞん: "保存",
		}

		for (const [incorrect, correct] of Object.entries(corrections)) {
			processed = processed.replace(new RegExp(incorrect, "g"), correct)
		}

		return processed
	}

	/**
	 * Clineコマンドの実行
	 * @param command 処理済みコマンド
	 * @returns 実行結果
	 */
	private async executeClineCommand(command: string): Promise<string> {
		try {
			// TODO: Cline APIの実際の呼び出し方法に応じて実装
			// 現在はモック実装
			const commandPatterns: { [key: string]: () => Promise<string> } = {
				ファイルを開いて: async () => {
					await vscode.commands.executeCommand("workbench.action.files.openFile")
					return "ファイルを開きました"
				},
				保存: async () => {
					await vscode.commands.executeCommand("workbench.action.files.save")
					return "ファイルを保存しました"
				},
				ヘルプ: async () => {
					return "利用可能なコマンド: ファイルを開いて、保存、ヘルプ"
				},
			}

			// コマンドパターンの検索
			for (const [pattern, handler] of Object.entries(commandPatterns)) {
				if (command.includes(pattern)) {
					return await handler()
				}
			}

			return "コマンドを認識できませんでした"
		} catch (error) {
			console.error("Clineコマンド実行エラー:", error)
			throw error
		}
	}

	/**
	 * 音声フィードバックの再生
	 * @param message フィードバックメッセージ
	 */
	async provideFeedback(message: string): Promise<void> {
		try {
			const audioData = await this.voiceSynthesis.synthesize(message)
			await this.voiceSynthesis.speak(audioData)
		} catch (error) {
			console.error("音声フィードバックエラー:", error)
			// フォールバック: テキスト通知
			vscode.window.showInformationMessage(message)
		}
	}
}

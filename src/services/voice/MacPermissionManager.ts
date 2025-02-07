import * as vscode from "vscode"
import * as cp from "child_process"
import { promisify } from "util"

const exec = promisify(cp.exec)

/**
 * macOSのマイク権限を管理するクラス
 */
export class MacPermissionManager {
	private static outputChannel: vscode.OutputChannel

	private static getOutputChannel(): vscode.OutputChannel {
		if (!this.outputChannel) {
			this.outputChannel = vscode.window.createOutputChannel("Voice Permission")
		}
		return this.outputChannel
	}

	/**
	 * マイク権限の状態を確認
	 */
	static async checkMicrophonePermission(): Promise<boolean> {
		try {
			const { stdout } = await exec('osascript -e "tell application \\"System Events\\" to get microphone enabled"')
			return stdout.trim() === "true"
		} catch {
			return false
		}
	}

	/**
	 * マイク権限を要求
	 */
	static async requestMicrophonePermission(): Promise<boolean> {
		try {
			const hasPermission = await this.checkMicrophonePermission()
			if (hasPermission) {
				return true
			}

			// システム環境設定を開く
			const action = await vscode.window.showInformationMessage(
				"マイクの使用には権限が必要です。以下の手順で設定してください:\n\n" +
					"1. システム環境設定の「セキュリティとプライバシー」を開きます\n" +
					"2. 「プライバシー」タブの「マイク」を選択します\n" +
					"3. VSCodeの横のチェックボックスをオンにします\n" +
					"4. VSCodeを再起動します\n\n" +
					"システム環境設定を開きますか?",
				{ modal: true },
				"設定を開く",
				"キャンセル",
			)

			if (!action || action === "キャンセル") {
				const outputChannel = this.getOutputChannel()
				outputChannel.appendLine("ユーザーが権限設定をキャンセルしました")
				return false
			}

			// マイク権限の設定画面を開く
			await this.openSystemPreferences()

			// ユーザーに権限を付与するよう促す
			const granted = await vscode.window.showInformationMessage(
				"マイクの使用を許可し、VSCodeを再起動してください。\n" + "準備ができたら「完了」を押してください。",
				{ modal: true },
				"完了",
				"キャンセル",
			)

			if (!granted || granted === "キャンセル") {
				const outputChannel = this.getOutputChannel()
				outputChannel.appendLine("ユーザーが権限設定プロセスをキャンセルしました")
				return false
			}

			// VSCodeの再起動を促す
			const restart = await vscode.window.showInformationMessage(
				"VSCodeを再起動して変更を適用する必要があります。\n" + "再起動しますか?",
				{ modal: true },
				"再起動",
				"キャンセル",
			)

			if (!restart || restart === "キャンセル") {
				const outputChannel = this.getOutputChannel()
				outputChannel.appendLine("ユーザーが再起動をキャンセルしました")
				return false
			}

			if (restart === "再起動") {
				await vscode.commands.executeCommand("workbench.action.reloadWindow")
			}

			// 権限の状態を再確認
			return await this.checkMicrophonePermission()
		} catch (error) {
			console.error("マイク権限の要求エラー:", error)
			const outputChannel = this.getOutputChannel()
			outputChannel.appendLine(`マイク権限の要求中にエラーが発生しました: ${error}`)
			return false
		}
	}

	/**
	 * マイク権限の状態を監視
	 */
	static async watchPermissionChanges(callback: (hasPermission: boolean) => void): Promise<void> {
		let previousState = await this.checkMicrophonePermission()

		// 定期的に権限の状態をチェック
		setInterval(async () => {
			try {
				const currentState = await this.checkMicrophonePermission()
				if (currentState !== previousState) {
					const outputChannel = this.getOutputChannel()
					outputChannel.appendLine("マイク権限の状態が変更されました:")
					outputChannel.appendLine(`- 前回の状態: ${previousState}`)
					outputChannel.appendLine(`- 現在の状態: ${currentState}`)

					previousState = currentState
					callback(currentState)
				}
			} catch (error) {
				console.error("権限監視エラー:", error)
			}
		}, 2000) // 2秒ごとにチェック
	}

	/**
	 * マイク権限が拒否された場合のヘルプを表示
	 */
	static async showPermissionHelp(): Promise<void> {
		// 現在の権限状態を確認
		const permissionStatus = await this.checkMicrophonePermission()
		const outputChannel = this.getOutputChannel()
		outputChannel.appendLine(`現在のマイク権限状態: ${permissionStatus}`)

		const action = await vscode.window.showInformationMessage(
			"マイクの使用が許可されていません。以下の手順で設定してください:\n\n" +
				"1. システム環境設定の「セキュリティとプライバシー」を開く\n" +
				"2. 「プライバシー」タブの「マイク」を選択\n" +
				"3. VSCodeの横のチェックボックスをオンにする\n" +
				"4. VSCodeを再起動する\n\n" +
				"システム環境設定を開きますか?",
			{ modal: true },
			"設定を開く",
			"キャンセル",
		)

		if (action === "設定を開く") {
			await this.openSystemPreferences()
		} else {
			outputChannel.appendLine("ユーザーがヘルプをキャンセルしました")
		}
	}

	/**
	 * システム環境設定を開く
	 */
	static async openSystemPreferences(): Promise<void> {
		await exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"')
	}
}

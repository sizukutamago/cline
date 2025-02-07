import * as vscode from "vscode"
import { VoiceManager } from "./services/voice/VoiceManager"

export function activate(context: vscode.ExtensionContext) {
	try {
		// 音声機能マネージャーの初期化
		const voiceManager = new VoiceManager(context)

		// コマンドの登録
		voiceManager.registerCommands(context)

		// リソース解放の登録
		context.subscriptions.push({
			dispose: () => {
				voiceManager.dispose()
			},
		})

		// 初期化成功メッセージ
		vscode.window.showInformationMessage(
			"Cline音声機能が初期化されました。ステータスバーのアイコンをクリックして開始できます。",
		)
	} catch (error) {
		// 初期化エラーの処理
		console.error("Cline音声機能の初期化エラー:", error)
		vscode.window.showErrorMessage(
			"Cline音声機能の初期化に失敗しました: " + (error instanceof Error ? error.message : String(error)),
		)
	}
}

export function deactivate() {
	// 拡張機能の終了処理は自動的に行われます
}

// package.jsonに追加が必要なコマンド設定:
/*
{
  "contributes": {
    "commands": [
      {
        "command": "cline.toggleVoiceRecognition",
        "title": "Cline: 音声認識の開始/停止",
        "category": "Cline"
      }
    ]
  }
}
*/

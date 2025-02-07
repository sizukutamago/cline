import * as assert from "assert"
import * as vscode from "vscode"
import { MacPermissionManager } from "../../services/voice/MacPermissionManager"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

suite("Mac Permission Test Suite", () => {
	// macOS環境でのみテストを実行
	const isMacOS = process.platform === "darwin"
	if (!isMacOS) {
		test("Skip tests on non-macOS platform", () => {
			console.log("Skipping MacPermissionManager tests on non-macOS platform")
		})
		return
	}

	test("マイク権限の確認", async () => {
		// execをモックしてボリューム設定を返す
		const originalExec = exec
		;(global as any).exec = (command: string, callback: any) => {
			if (command.includes("get volume settings")) {
				callback(null, { stdout: "output volume:50, input volume:75, alert volume:100, output muted:false" })
			} else {
				callback(new Error("Unexpected command"))
			}
		}

		try {
			const hasPermission = await MacPermissionManager.checkMicrophonePermission()
			assert.strictEqual(hasPermission, true, "権限が正しく確認されること")
		} finally {
			;(global as any).exec = originalExec
		}
	})

	test("マイク権限なしの確認", async () => {
		// execをモックしてボリューム0を返す
		const originalExec = exec
		;(global as any).exec = (command: string, callback: any) => {
			if (command.includes("get volume settings")) {
				callback(null, { stdout: "output volume:50, input volume:0, alert volume:100, output muted:false" })
			} else {
				callback(new Error("Unexpected command"))
			}
		}

		try {
			const hasPermission = await MacPermissionManager.checkMicrophonePermission()
			assert.strictEqual(hasPermission, false, "権限なしが正しく確認されること")
		} finally {
			;(global as any).exec = originalExec
		}
	})

	test("不正な出力形式の処理", async () => {
		// execをモックして不正な形式の出力を返す
		const originalExec = exec
		;(global as any).exec = (command: string, callback: any) => {
			if (command.includes("get volume settings")) {
				callback(null, { stdout: "invalid format" })
			} else {
				callback(new Error("Unexpected command"))
			}
		}

		try {
			const hasPermission = await MacPermissionManager.checkMicrophonePermission()
			assert.strictEqual(hasPermission, false, "不正な形式の場合はfalseを返すこと")
		} finally {
			;(global as any).exec = originalExec
		}
	})

	test("マイク権限の要求UI", async () => {
		let showMessageCalled = false
		let openSettingsCalled = false

		// VSCodeのAPIをモック
		const originalShowInformation = vscode.window.showInformationMessage
		vscode.window.showInformationMessage = async (...args: any[]) => {
			showMessageCalled = true
			return "設定を開く"
		}

		// execを部分的にモック
		const originalExec = exec
		;(global as any).exec = (command: string, callback: any) => {
			if (command.includes("systempreferences")) {
				openSettingsCalled = true
			} else if (command.includes("get volume settings")) {
				callback(null, { stdout: "output volume:50, input volume:75, alert volume:100, output muted:false" })
			}
			callback(null, { stdout: "", stderr: "" })
		}

		try {
			await MacPermissionManager.requestMicrophonePermission()
			assert.ok(showMessageCalled, "ダイアログが表示されること")
			assert.ok(openSettingsCalled, "システム環境設定が開かれること")
		} finally {
			vscode.window.showInformationMessage = originalShowInformation
			;(global as any).exec = originalExec
		}
	})

	test("権限変更の監視", async () => {
		let callbackCalled = false
		const callback = (hasPermission: boolean) => {
			callbackCalled = true
		}

		// execをモックして権限状態の変更をシミュレート
		const originalExec = exec
		let volumeValue = "0"
		;(global as any).exec = (command: string, callback: any) => {
			if (command.includes("get volume settings")) {
				const output =
					volumeValue === "0"
						? "output volume:50, input volume:0, alert volume:100, output muted:false"
						: "output volume:50, input volume:75, alert volume:100, output muted:false"
				callback(null, { stdout: output })
				// 次回の呼び出しで異なる値を返す
				volumeValue = "75"
			} else {
				callback(new Error("Unexpected command"))
			}
		}

		try {
			await MacPermissionManager.watchPermissionChanges(callback)
			// 少し待機して権限変更をシミュレート
			await new Promise((resolve) => setTimeout(resolve, 2500))
			assert.ok(callbackCalled, "コールバックが呼び出されること")
		} finally {
			;(global as any).exec = originalExec
		}
	})

	test("エラーケースの処理", async () => {
		// execをモックしてエラーを発生させる
		const originalExec = exec
		;(global as any).exec = (command: string, callback: any) => {
			callback(new Error("Test error"), null)
		}

		try {
			const hasPermission = await MacPermissionManager.checkMicrophonePermission()
			assert.strictEqual(hasPermission, false, "エラー時はfalseを返すこと")
		} finally {
			;(global as any).exec = originalExec
		}
	})

	test("コマンドキャンセルの処理", async () => {
		// VSCodeのAPIをモック
		const originalShowInformation = vscode.window.showInformationMessage
		vscode.window.showInformationMessage = async (...args: any[]) => {
			return "キャンセル"
		}

		try {
			const result = await MacPermissionManager.requestMicrophonePermission()
			assert.strictEqual(result, false, "キャンセル時はfalseを返すこと")
		} finally {
			vscode.window.showInformationMessage = originalShowInformation
		}
	})
})

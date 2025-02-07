import { VoiceRecognitionService, VoiceRecognitionError, VoiceRecognitionErrorCode } from "./types"

/**
 * Web Speech APIを使用した音声認識サービスの実装
 */
export class WebSpeechRecognitionService implements VoiceRecognitionService {
	private recognition: SpeechRecognition
	private isListening: boolean = false

	constructor() {
		if (!("webkitSpeechRecognition" in window)) {
			throw new VoiceRecognitionError("このブラウザは音声認識をサポートしていません", VoiceRecognitionErrorCode.NOT_ALLOWED)
		}

		// Web Speech APIの初期化
		this.recognition = new (window as any).webkitSpeechRecognition()
		this.recognition.lang = "ja-JP"
		this.recognition.continuous = true
		this.recognition.interimResults = false

		// デフォルトのエラーハンドラー
		this.recognition.onerror = this.handleError.bind(this)
	}

	/**
	 * 音声認識を開始
	 */
	async startListening(): Promise<void> {
		if (this.isListening) {
			return
		}

		try {
			// マイクの権限を確認
			const permission = await navigator.permissions.query({
				name: "microphone" as PermissionName,
			})

			if (permission.state === "denied") {
				throw new VoiceRecognitionError("マイクの使用が許可されていません", VoiceRecognitionErrorCode.NOT_ALLOWED)
			}

			// マイクへのアクセスを確認
			await navigator.mediaDevices.getUserMedia({ audio: true })

			this.isListening = true
			this.recognition.start()
		} catch (error) {
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
		if (!this.isListening) {
			return
		}

		this.isListening = false
		this.recognition.stop()
	}

	/**
	 * 音声認識結果のコールバックを設定
	 */
	onResult(callback: (text: string) => void): void {
		this.recognition.onresult = (event: SpeechRecognitionEvent) => {
			const result = event.results[event.results.length - 1]
			if (result.isFinal) {
				const text = result[0].transcript.trim()
				if (text) {
					callback(text)
				}
			}
		}
	}

	/**
	 * エラーハンドリングのコールバックを設定
	 */
	onError(callback: (error: VoiceRecognitionError) => void): void {
		this.errorCallback = callback
	}

	private errorCallback: ((error: VoiceRecognitionError) => void) | null = null

	/**
	 * Web Speech APIのエラーを処理
	 */
	private handleError(event: SpeechRecognitionErrorEvent): void {
		let error: VoiceRecognitionError

		switch (event.error) {
			case "no-speech":
				error = new VoiceRecognitionError("音声が検出されませんでした", VoiceRecognitionErrorCode.NO_SPEECH)
				break
			case "audio-capture":
				error = new VoiceRecognitionError("マイクにアクセスできません", VoiceRecognitionErrorCode.AUDIO_CAPTURE)
				break
			case "not-allowed":
				error = new VoiceRecognitionError("マイクの使用が許可されていません", VoiceRecognitionErrorCode.NOT_ALLOWED)
				break
			case "network":
				error = new VoiceRecognitionError("ネットワークエラーが発生しました", VoiceRecognitionErrorCode.NETWORK)
				break
			case "bad-grammar":
				error = new VoiceRecognitionError("文法エラーが発生しました", VoiceRecognitionErrorCode.BAD_GRAMMAR)
				break
			case "language-not-supported":
				error = new VoiceRecognitionError(
					"指定された言語はサポートされていません",
					VoiceRecognitionErrorCode.LANGUAGE_NOT_SUPPORTED,
				)
				break
			default:
				error = new VoiceRecognitionError("音声認識エラーが発生しました", VoiceRecognitionErrorCode.NOT_ALLOWED)
		}

		this.isListening = false
		if (this.errorCallback) {
			this.errorCallback(error)
		}
	}
}

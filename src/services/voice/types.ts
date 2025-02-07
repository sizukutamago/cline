/**
 * 音声認識サービスのインターフェース
 */
export interface VoiceRecognitionService {
	/**
	 * 音声認識を開始
	 * @throws {VoiceRecognitionError} マイクアクセスエラーなど
	 */
	startListening(): Promise<void>

	/**
	 * 音声認識を停止
	 */
	stopListening(): void

	/**
	 * 音声認識結果のコールバックを設定
	 * @param callback 認識結果を受け取るコールバック関数
	 */
	onResult(callback: (text: string) => void): void

	/**
	 * エラーハンドリングのコールバックを設定
	 * @param callback エラーを受け取るコールバック関数
	 */
	onError(callback: (error: VoiceRecognitionError) => void): void
}

/**
 * 音声合成サービスのインターフェース
 */
export interface VoiceSynthesisService {
	/**
	 * テキストを音声に変換
	 * @param text 変換するテキスト
	 * @returns 音声データ
	 * @throws {VoicevoxError} 音声合成エラー
	 */
	synthesize(text: string): Promise<ArrayBuffer>

	/**
	 * 音声を再生
	 * @param audioData 再生する音声データ
	 */
	speak(audioData: ArrayBuffer): Promise<void>
}

/**
 * 音声認識エラー
 */
export class VoiceRecognitionError extends Error {
	constructor(
		message: string,
		public readonly code: VoiceRecognitionErrorCode,
	) {
		super(message)
		this.name = "VoiceRecognitionError"
	}
}

/**
 * 音声認識エラーコード
 */
export enum VoiceRecognitionErrorCode {
	NO_SPEECH = "no-speech",
	AUDIO_CAPTURE = "audio-capture",
	NOT_ALLOWED = "not-allowed",
	NETWORK = "network",
	BAD_GRAMMAR = "bad-grammar",
	LANGUAGE_NOT_SUPPORTED = "language-not-supported",
}

/**
 * VOICEVOX関連のエラー
 */
export class VoicevoxError extends Error {
	constructor(
		message: string,
		public readonly statusCode: number,
	) {
		super(message)
		this.name = "VoicevoxError"
	}
}

/**
 * 音声コマンドのハンドラーインターフェース
 */
export interface VoiceCommandHandler {
	/**
	 * 音声コマンドを処理
	 * @param command 音声コマンド
	 * @returns 処理結果のメッセージ
	 */
	handleCommand(command: string): Promise<string>
}

/**
 * VOICEVOXの設定
 */
export interface VoicevoxConfig {
	/** APIエンドポイント */
	apiEndpoint: string
	/** 話者ID */
	speakerId: number
}

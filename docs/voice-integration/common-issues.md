# 音声認識・テキスト読み上げ機能の一般的な問題と解決方法

## 1. 音声認識の問題

### 1.1 マイク初期化エラー

#### 症状
```typescript
VoiceRecognitionError: マイクの初期化に失敗しました
code: VoiceRecognitionErrorCode.AUDIO_CAPTURE
```

#### 原因
- マイクデバイスへのアクセス権限がない
- マイクが他のアプリケーションで使用中
- ドライバーの問題

#### 解決方法
1. システム権限の確認
```bash
# macOSの場合
open "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
```

2. 使用中のアプリケーションの確認
```bash
# マイクを使用中のプロセスを確認
lsof | grep -i "audio"
```

3. ドライバーの再インストール
- システム設定からオーディオデバイスを一度削除
- デバイスを再接続して再認識させる

### 1.2 認識精度の問題

#### 症状
- 音声が正しく認識されない
- 誤認識が頻繁に発生
- 特定の単語が認識されにくい

#### 解決方法
1. 音声入力の最適化
```typescript
// 認識パラメータの調整
const recognition = new WebSpeechRecognitionService({
  continuous: true,
  interimResults: false,
  maxAlternatives: 1,
  lang: 'ja-JP'
});
```

2. ノイズ削減設定
```typescript
// オーディオコンテキストでノイズ削減フィルターを適用
const audioContext = new AudioContext();
const filter = audioContext.createBiquadFilter();
filter.type = 'lowpass';
filter.frequency.value = 1000;
```

## 2. VOICEVOX関連の問題

### 2.1 接続エラー

#### 症状
```typescript
VoicevoxError: VOICEVOXサービスとの通信に失敗しました
statusCode: 500
```

#### 解決方法
1. サービス状態の確認
```bash
# エンドポイントの確認
curl http://localhost:50021/version

# プロセスの確認と再起動
pkill -f voicevox
open -a VOICEVOX
```

2. ネットワーク設定の確認
```bash
# ポートの使用状況確認
netstat -an | grep 50021

# ファイアウォール設定の確認
sudo lsof -i :50021
```

### 2.2 音声合成の品質問題

#### 症状
- 音声が不自然
- 発話速度が適切でない
- 音質が悪い

#### 解決方法
1. パラメータの最適化
```typescript
// 音声合成パラメータの調整
const optimizedQuery = {
  ...query,
  speedScale: 1.2,        // 話速
  volumeScale: 1.0,       // 音量
  prePhonemeLength: 0.1,  // 音声前の無音時間
  postPhonemeLength: 0.1, // 音声後の無音時間
  outputSamplingRate: 24000,
  outputStereo: false
};
```

2. キャッシュの活用
```typescript
// キャッシュ制御の実装
class VoicevoxCache {
  private static cache = new Map<string, ArrayBuffer>();

  static async getOrSynthesize(
    text: string,
    service: VoicevoxService
  ): Promise<ArrayBuffer> {
    const key = `${text}_${service.speakerId}`;
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    const audio = await service.synthesize(text);
    this.cache.set(key, audio);
    return audio;
  }
}
```

## 3. システムリソースの問題

### 3.1 メモリ使用量の増大

#### 症状
- アプリケーションの応答が遅くなる
- メモリ警告が表示される
- クラッシュが発生

#### 解決方法
1. リソース監視
```typescript
// メモリ使用量の監視
class ResourceMonitor {
  private static readonly MEMORY_THRESHOLD = 500 * 1024 * 1024; // 500MB

  static async checkMemoryUsage(): Promise<void> {
    const used = process.memoryUsage().heapUsed;
    if (used > this.MEMORY_THRESHOLD) {
      await this.cleanup();
    }
  }

  private static async cleanup(): Promise<void> {
    // キャッシュのクリア
    VoicevoxCache.clear();
    // ガベージコレクションの実行
    global.gc();
  }
}
```

2. 定期的なクリーンアップ
```typescript
// 定期的なクリーンアップタスク
setInterval(() => {
  ResourceMonitor.checkMemoryUsage();
}, 5 * 60 * 1000); // 5分ごと
```

## 4. 再発防止策

### 4.1 エラー監視とロギング

```typescript
class VoiceErrorMonitor {
  private static errorCounts = new Map<string, number>();
  private static readonly ERROR_THRESHOLD = 3;

  static logError(error: Error): void {
    const errorKey = error.name;
    const count = (this.errorCounts.get(errorKey) || 0) + 1;
    this.errorCounts.set(errorKey, count);

    if (count >= this.ERROR_THRESHOLD) {
      this.handleRecurringError(errorKey, error);
    }

    // エラーログの記録
    console.error(`[${new Date().toISOString()}] ${error.name}: ${error.message}`);
  }

  private static handleRecurringError(key: string, error: Error): void {
    // 再発性エラーの対処
    switch (key) {
      case 'VoiceRecognitionError':
        this.handleRecurringVoiceError();
        break;
      case 'VoicevoxError':
        this.handleRecurringVoicevoxError();
        break;
    }
  }

  private static handleRecurringVoiceError(): void {
    // マイクの再初期化
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => this.errorCounts.clear())
      .catch(console.error);
  }

  private static handleRecurringVoicevoxError(): void {
    // VOICEVOXサービスの再起動を提案
    vscode.window.showWarningMessage(
      'VOICEVOXサービスに問題が発生しています。再起動を推奨します。'
    );
  }
}
```

### 4.2 自動リカバリー機能

```typescript
class VoiceRecoveryManager {
  private static isRecovering = false;

  static async attemptRecovery(error: Error): Promise<boolean> {
    if (this.isRecovering) return false;
    
    this.isRecovering = true;
    try {
      switch (error.name) {
        case 'VoiceRecognitionError':
          return await this.recoverVoiceRecognition();
        case 'VoicevoxError':
          return await this.recoverVoicevox();
        default:
          return false;
      }
    } finally {
      this.isRecovering = false;
    }
  }

  private static async recoverVoiceRecognition(): Promise<boolean> {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch {
      return false;
    }
  }

  private static async recoverVoicevox(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:50021/version');
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

## 5. パフォーマンス最適化

### 5.1 音声認識の最適化

```typescript
class OptimizedVoiceRecognition {
  private static readonly DEBOUNCE_TIME = 300; // ms
  private static timeoutId: NodeJS.Timeout | null = null;

  static debounceRecognition(
    callback: (text: string) => void
  ): (text: string) => void {
    return (text: string) => {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
      this.timeoutId = setTimeout(() => {
        callback(text);
        this.timeoutId = null;
      }, this.DEBOUNCE_TIME);
    };
  }
}
```

### 5.2 音声合成の最適化

```typescript
class OptimizedVoiceSynthesis {
  private static readonly CACHE_SIZE = 100;
  private static cache = new Map<string, ArrayBuffer>();

  static async synthesize(
    text: string,
    service: VoicevoxService
  ): Promise<ArrayBuffer> {
    const key = this.getCacheKey(text);
    
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const audio = await service.synthesize(text);
    
    if (this.cache.size >= this.CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, audio);
    return audio;
  }

  private static getCacheKey(text: string): string {
    return `${text}_${Date.now()}`;
  }
}
```

## 6. 定期的なメンテナンス

### 6.1 ヘルスチェック

```typescript
class VoiceSystemHealthCheck {
  static async runHealthCheck(): Promise<boolean> {
    try {
      // マイクの確認
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // VOICEVOXの確認
      const voicevoxResponse = await fetch('http://localhost:50021/version');
      if (!voicevoxResponse.ok) {
        throw new Error('VOICEVOX service is not responding');
      }
      
      // メモリ使用量の確認
      const memoryUsage = process.memoryUsage().heapUsed;
      if (memoryUsage > 1000 * 1024 * 1024) { // 1GB
        throw new Error('Memory usage is too high');
      }
      
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}
```

### 6.2 定期的なクリーンアップ

```typescript
class MaintenanceScheduler {
  static schedule(): void {
    // 毎日午前3時にメンテナンスを実行
    const now = new Date();
    const night = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      3, 0, 0
    );
    
    const timeUntilMaintenance = night.getTime() - now.getTime();
    
    setTimeout(() => {
      this.performMaintenance();
      this.schedule(); // 次回のスケジュール
    }, timeUntilMaintenance);
  }

  private static async performMaintenance(): Promise<void> {
    // キャッシュのクリーンアップ
    OptimizedVoiceSynthesis.cache.clear();
    
    // ヘルスチェックの実行
    await VoiceSystemHealthCheck.runHealthCheck();
    
    // エラーカウンターのリセット
    VoiceErrorMonitor.errorCounts.clear();
    
    // ログの圧縮
    await this.compressLogs();
  }

  private static async compressLogs(): Promise<void> {
    // ログファイルの圧縮処理
  }
}
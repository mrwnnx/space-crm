// opus-recorder ne livre pas de types. Seule la surface utilisée par le
// bouton 🎤 est déclarée ici.
declare module "opus-recorder" {
  type RecorderConfig = {
    encoderPath?: string;
    encoderApplication?: 2048 | 2049 | 2051;
    encoderSampleRate?: 8000 | 12000 | 16000 | 24000 | 48000;
    encoderBitRate?: number;
    numberOfChannels?: 1 | 2;
    mediaTrackConstraints?: boolean | MediaTrackConstraints;
  };
  export default class Recorder {
    constructor(config?: RecorderConfig);
    start(): Promise<void>;
    stop(): void;
    close(): void;
    ondataavailable: (data: Uint8Array) => void;
    onstart: () => void;
    onstop: () => void;
    encodedSamplePosition: number;
  }
}

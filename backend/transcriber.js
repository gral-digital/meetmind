import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";

export class Transcriber {
  constructor(apiKey) {
    this.client = createClient(apiKey);
    this.connection = null;
    this.onTranscript = null;
    this.buffer = []; // rolling transcript buffer
    this.maxBufferAge = 60_000; // 60 seconds
  }

  async start() {
    this.connection = this.client.listen.live({
      model: "nova-3",
      language: "multi",
      smart_format: true,
      diarize: true,
      encoding: "linear16",
      sample_rate: 16000,
      channels: 1,
      interim_results: true,
      utterance_end_ms: 1500,
    });

    return new Promise((resolve, reject) => {
      this.connection.on(LiveTranscriptionEvents.Open, () => {
        console.log("[Transcriber] Deepgram connection opened");
        resolve();
      });

      this.connection.on(LiveTranscriptionEvents.Error, (err) => {
        console.error("[Transcriber] Deepgram error:", err);
        reject(err);
      });

      this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const alt = data.channel?.alternatives?.[0];
        if (!alt || !alt.transcript) return;

        const isFinal = data.is_final;
        const transcript = alt.transcript.trim();
        if (!transcript) return;

        // Extract speaker from words
        const speaker = alt.words?.[0]?.speaker ?? null;

        if (isFinal) {
          this.buffer.push({
            text: transcript,
            speaker,
            timestamp: Date.now(),
          });
          this.pruneBuffer();
        }

        if (this.onTranscript) {
          this.onTranscript({
            text: transcript,
            speaker,
            isFinal,
            context: this.getContext(),
          });
        }
      });

      this.connection.on(LiveTranscriptionEvents.Close, () => {
        console.log("[Transcriber] Deepgram connection closed");
      });
    });
  }

  sendAudio(audioBuffer) {
    if (this.connection) {
      this.connection.send(audioBuffer);
    }
  }

  getContext() {
    this.pruneBuffer();
    return this.buffer
      .map((entry) => {
        const label = entry.speaker !== null ? `Speaker ${entry.speaker}` : "Unknown";
        return `[${label}]: ${entry.text}`;
      })
      .join("\n");
  }

  pruneBuffer() {
    const cutoff = Date.now() - this.maxBufferAge;
    this.buffer = this.buffer.filter((entry) => entry.timestamp > cutoff);
  }

  stop() {
    if (this.connection) {
      this.connection.requestClose();
      this.connection = null;
    }
    this.buffer = [];
  }
}

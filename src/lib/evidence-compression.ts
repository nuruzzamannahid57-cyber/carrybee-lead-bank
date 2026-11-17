'use client';

export const MAX_EVIDENCE_BYTES = 20 * 1024 * 1024;

export interface CompressedEvidence {
  blob: Blob;
  mimeType: string;
  extension: string;
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not compress this image in your browser.'));
    }, type, quality);
  });
}

async function compressImage(file: File): Promise<CompressedEvidence> {
  const bitmap = await createImageBitmap(file);
  try {
    const maxDimension = 1920;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image compression is not supported in this browser.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob = await canvasBlob(canvas, 'image/webp', 0.78);
    if (blob.size > MAX_EVIDENCE_BYTES) blob = await canvasBlob(canvas, 'image/jpeg', 0.68);
    if (blob.size > MAX_EVIDENCE_BYTES) throw new Error('Image is still over 20 MB after compression.');
    return { blob, mimeType: blob.type || 'image/webp', extension: blob.type === 'image/jpeg' ? 'jpg' : 'webp' };
  } finally {
    bitmap.close();
  }
}

async function encodeAudioAsMp3(file: File): Promise<CompressedEvidence> {
  const AudioContextCtor = window.AudioContext;
  if (!AudioContextCtor) throw new Error('Audio compression is not supported in this browser. Use MP3, M4A, OGG, or WebM audio.');
  const audioContext = new AudioContextCtor();
  try {
    const decoded = await audioContext.decodeAudioData(await file.arrayBuffer());
    const { Mp3Encoder } = await import('@breezystack/lamejs');

    const targetRate = 24000;
    const frameCount = Math.ceil((decoded.length * targetRate) / decoded.sampleRate);
    const pcm = new Int16Array(frameCount);
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, channel) => decoded.getChannelData(channel));
    for (let i = 0; i < frameCount; i++) {
      const sourcePosition = (i * decoded.sampleRate) / targetRate;
      const left = Math.min(decoded.length - 1, Math.floor(sourcePosition));
      const right = Math.min(decoded.length - 1, left + 1);
      const fraction = sourcePosition - left;
      let sample = 0;
      for (const channel of channels) {
        sample += channel[left] * (1 - fraction) + channel[right] * fraction;
      }
      sample /= channels.length || 1;
      pcm[i] = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    }

    const encoder = new Mp3Encoder(1, targetRate, 64);
    const chunks: ArrayBuffer[] = [];
    const blockSize = 1152;
    for (let offset = 0; offset < pcm.length; offset += blockSize) {
      const chunk = encoder.encodeBuffer(pcm.subarray(offset, Math.min(offset + blockSize, pcm.length)));
      if (chunk.length) chunks.push(Uint8Array.from(chunk).buffer as ArrayBuffer);
    }
    const tail = encoder.flush();
    if (tail.length) chunks.push(Uint8Array.from(tail).buffer as ArrayBuffer);
    const blob = new Blob(chunks, { type: 'audio/mpeg' });
    if (!blob.size || blob.size > MAX_EVIDENCE_BYTES) throw new Error('Recording is still over 20 MB after compression.');
    return { blob, mimeType: 'audio/mpeg', extension: 'mp3' };
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}

export async function compressEvidenceFile(file: File): Promise<CompressedEvidence> {
  if (!file.size || file.size > MAX_EVIDENCE_BYTES) {
    throw new Error('Choose a file under 20 MB before compression.');
  }
  if (file.type.startsWith('image/')) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Screenshots must be JPG, PNG, or WebP.');
    }
    return compressImage(file);
  }
  if (!file.type.startsWith('audio/')) {
    throw new Error('Upload a screenshot or an audio call recording.');
  }
  const supportedAudio = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 'audio/ogg', 'audio/wav', 'audio/x-wav'];
  if (!supportedAudio.includes(file.type)) throw new Error('Use MP3, M4A, WebM, OGG, or WAV audio.');
  if (file.type === 'audio/wav' || file.type === 'audio/x-wav' || file.size > 8 * 1024 * 1024) {
    return encodeAudioAsMp3(file);
  }
  // MP3, M4A, WebM and OGG are already compressed audio formats; retain their efficient encoding.
  return { blob: file, mimeType: file.type, extension: file.type === 'audio/mpeg' ? 'mp3' : file.type === 'audio/mp4' || file.type === 'audio/x-m4a' ? 'm4a' : file.type === 'audio/ogg' ? 'ogg' : 'webm' };
}

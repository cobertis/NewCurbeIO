import ffmpeg from "fluent-ffmpeg";
import * as fs from "fs";
import * as path from "path";

export interface AudioMetadata {
  duration: number;
  waveform: number[];
  mimeType: string;
  uti: string;
  codec: string;
  sampleRate: number;
}

export interface ConversionResult {
  path: string;
  metadata: AudioMetadata;
}

export async function convertWebMToCAF(inputPath: string): Promise<ConversionResult> {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath.replace(/\.[^/.]+$/, '.caf');
    
    console.log(`[Audio Converter] Converting ${inputPath} to ${outputPath}`);
    
    ffmpeg(inputPath)
      .audioCodec('pcm_s16le')
      .audioFrequency(24000)
      .audioChannels(1)
      .format('caf')
      .on('start', (cmd) => {
        console.log(`[Audio Converter] FFmpeg command: ${cmd}`);
      })
      .on('error', (err) => {
        console.error(`[Audio Converter] Conversion error:`, err);
        ffmpeg(inputPath)
          .audioCodec('aac')
          .audioFrequency(44100)
          .audioChannels(1)
          .audioBitrate('128k')
          .format('ipod')
          .on('error', (err2) => {
            console.error(`[Audio Converter] M4A fallback also failed:`, err2);
            reject(err2);
          })
          .on('end', async () => {
            const m4aPath = inputPath.replace(/\.[^/.]+$/, '.m4a');
            console.log(`[Audio Converter] M4A fallback successful: ${m4aPath}`);
            try {
              const metadata = await getAudioMetadata(m4aPath, 'aac', 'audio/mp4', 'public.mpeg-4-audio', 44100);
              fs.unlinkSync(inputPath);
              resolve({ path: m4aPath, metadata });
            } catch (metaErr) {
              reject(metaErr);
            }
          })
          .save(inputPath.replace(/\.[^/.]+$/, '.m4a'));
      })
      .on('end', async () => {
        console.log(`[Audio Converter] Conversion successful: ${outputPath}`);
        try {
          const metadata = await getAudioMetadata(outputPath, 'pcm_s16le', 'audio/x-caf', 'com.apple.coreaudio-format', 24000);
          fs.unlinkSync(inputPath);
          resolve({ path: outputPath, metadata });
        } catch (metaErr) {
          reject(metaErr);
        }
      })
      .save(outputPath);
  });
}

export async function convertToM4A(inputPath: string): Promise<ConversionResult> {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath.replace(/\.[^/.]+$/, '.m4a');
    
    console.log(`[Audio Converter] Converting ${inputPath} to M4A`);
    
    ffmpeg(inputPath)
      .audioCodec('aac')
      .audioFrequency(44100)
      .audioChannels(1)
      .audioBitrate('128k')
      .format('ipod')
      .on('start', (cmd) => {
        console.log(`[Audio Converter] FFmpeg command: ${cmd}`);
      })
      .on('error', (err) => {
        console.error(`[Audio Converter] M4A conversion error:`, err);
        reject(err);
      })
      .on('end', async () => {
        console.log(`[Audio Converter] M4A conversion successful: ${outputPath}`);
        try {
          const metadata = await getAudioMetadata(outputPath, 'aac', 'audio/mp4', 'public.mpeg-4-audio', 44100);
          fs.unlinkSync(inputPath);
          resolve({ path: outputPath, metadata });
        } catch (metaErr) {
          reject(metaErr);
        }
      })
      .save(outputPath);
  });
}

async function getAudioMetadata(
  filePath: string, 
  codec: string, 
  mimeType: string, 
  uti: string, 
  sampleRate: number
): Promise<AudioMetadata> {
  const duration = await extractAudioDuration(filePath);
  const waveform = await generateAudioWaveform(filePath);
  
  return {
    duration,
    waveform,
    mimeType,
    uti,
    codec,
    sampleRate
  };
}

export function extractAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error(`[Audio Converter] Duration extraction error:`, err);
        resolve(3000);
        return;
      }
      const durationSecs = metadata.format?.duration || 3;
      const durationMs = Math.round(durationSecs * 1000);
      console.log(`[Audio Converter] Duration: ${durationMs}ms`);
      resolve(durationMs);
    });
  });
}

export function generateAudioWaveform(filePath: string, samples: number = 50): Promise<number[]> {
  return new Promise((resolve) => {
    const waveform: number[] = [];
    for (let i = 0; i < samples; i++) {
      waveform.push(Math.floor(Math.random() * 100));
    }
    resolve(waveform);
  });
}

export function isAudioFile(mimeType: string, filename: string): boolean {
  if (mimeType.startsWith('audio/')) return true;
  const audioExtensions = ['.webm', '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.caf', '.opus'];
  const ext = path.extname(filename).toLowerCase();
  return audioExtensions.includes(ext);
}

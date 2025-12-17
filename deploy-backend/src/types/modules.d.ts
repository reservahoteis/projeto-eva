/**
 * Type declarations for modules without @types packages
 */

declare module 'sharp' {
  interface JpegOptions {
    quality?: number;
    mozjpeg?: boolean;
    chromaSubsampling?: string;
    progressive?: boolean;
    force?: boolean;
  }

  interface Sharp {
    resize(width?: number, height?: number, options?: object): Sharp;
    jpeg(options?: JpegOptions): Sharp;
    png(options?: { quality?: number; compressionLevel?: number }): Sharp;
    webp(options?: { quality?: number }): Sharp;
    toBuffer(): Promise<Buffer>;
    metadata(): Promise<{
      width?: number;
      height?: number;
      format?: string;
      size?: number;
    }>;
  }

  interface SharpOptions {
    failOnError?: boolean;
  }

  function sharp(input?: Buffer | string, options?: SharpOptions): Sharp;

  export = sharp;
}

declare module 'heic-convert' {
  interface HeicConvertOptions {
    buffer: Buffer;
    format: 'JPEG' | 'PNG';
    quality?: number;
  }

  function heicConvert(options: HeicConvertOptions): Promise<Uint8Array>;

  export default heicConvert;
}

import { describe, expect, it } from 'vitest';
import { isVideoContainer } from './video';

/**
 * El Content-Type que guarda S3 es el que declaro el cliente al subir, así que
 * HeadObject no distingue un video de un ejecutable renombrado. Leer los primeros
 * bytes es la única comprobación que mira el contenido real.
 */

const bytes = (...values: number[]) => new Uint8Array(values);

// "ftyp" en la posición 4, precedido por el tamaño de la caja.
const mp4 = bytes(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d);
// Cabecera EBML en la posición 0.
const webm = bytes(0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f);

describe('isVideoContainer', () => {
  it('reconoce un MP4', () => {
    expect(isVideoContainer(mp4)).toBe(true);
  });

  it('reconoce un WebM', () => {
    expect(isVideoContainer(webm)).toBe(true);
  });

  it('rechaza texto plano subido como video/mp4', () => {
    expect(isVideoContainer(new TextEncoder().encode('esto no es un video'))).toBe(false);
  });

  it('rechaza un PNG', () => {
    expect(isVideoContainer(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe(false);
  });

  it('rechaza un PDF', () => {
    expect(isVideoContainer(new TextEncoder().encode('%PDF-1.4'))).toBe(false);
  });

  it('rechaza un ejecutable de Windows', () => {
    expect(isVideoContainer(bytes(0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00))).toBe(false);
  });

  it('rechaza un archivo vacío o truncado sin reventar', () => {
    expect(isVideoContainer(bytes())).toBe(false);
    expect(isVideoContainer(bytes(0x00, 0x00))).toBe(false);
    expect(isVideoContainer(bytes(0x1a, 0x45))).toBe(false);
  });

  // "ftyp" tiene que estar en la posición 4, no en cualquier parte del archivo.
  it('rechaza "ftyp" en una posición distinta de la 4', () => {
    expect(isVideoContainer(bytes(0x66, 0x74, 0x79, 0x70, 0x00, 0x00, 0x00, 0x00))).toBe(false);
  });
});

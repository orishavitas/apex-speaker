'use client';

interface SpeakerCanvasProps {
  activeBrand: string | null;
}

export function SpeakerCanvas({ activeBrand: _ }: SpeakerCanvasProps) {
  return <div className="absolute inset-0 bg-black" />;
}

/** A decorative detail from untouched original artwork; never used for controls or data. */
export function ArtworkDetail({ src, sourceWidth, sourceHeight, box, className = '', preserveAspectRatio = 'xMidYMid meet' }: {
  src: string; sourceWidth: number; sourceHeight: number;
  box: [number, number, number, number]; className?: string; preserveAspectRatio?: string;
}) {
  return <svg preserveAspectRatio={preserveAspectRatio} viewBox={box.join(' ')} width={box[2]} height={box[3]} className={className} aria-hidden="true" focusable="false" overflow="hidden">
    <image href={src} width={sourceWidth} height={sourceHeight} />
  </svg>;
}

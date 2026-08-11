import type { CSSProperties } from "react";

/**
 * An image from the NHL CDN: a player headshot or a team logo.
 *
 * This is a plain `<img>` on purpose, and it is why
 * `@next/next/no-img-element` is off in `eslint.config.mjs`. Two reasons:
 *
 * - Team logos are SVG. The Next image optimizer refuses SVG unless
 *   `dangerouslyAllowSVG` is set, and it would gain nothing. An SVG is already
 *   small and resolution-independent.
 * - Headshots are small PNGs, rendered between 12px and 160px. On Vercel every
 *   distinct size is a billed transformation, and the leaderboard alone shows
 *   100 of them per view. The bytes saved do not pay for that.
 *
 * Route every remote image through here. The rule exists to stop an unsized,
 * eagerly loaded `<img>` reaching a page, so this component supplies what the
 * rule protects: intrinsic `width` and `height` so the browser reserves the
 * box before the image arrives, lazy loading, and async decoding.
 *
 * `width` and `height` are the intrinsic size in pixels. They are attributes,
 * not CSS, so any `className` or `style` the caller passes still wins. Pass
 * the size the image actually renders at.
 */
export function RemoteImage({
  src,
  alt,
  width,
  height,
  className,
  style,
  eager = false,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  style?: CSSProperties;
  /** Set for an image above the fold, which should not wait for lazy loading. */
  eager?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see the note above
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className}
      style={style}
    />
  );
}

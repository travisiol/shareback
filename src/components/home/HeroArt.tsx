import { BrandMark } from "../BrandMark";
import { LogoMark } from "../Logo";
import { TrendIcon } from "../icons";

/** Deterministic barcode: bar widths from a fixed pattern, not random. */
const BARS = "31121312211321121131221113122131121231121321112213112131221113211221311213".split("").map(Number);

const BAR_OFFSETS = BARS.map((_, index) => BARS.slice(0, index).reduce((sum, width) => sum + width, 0));
const BAR_TOTAL = BARS.reduce((sum, width) => sum + width, 0);

function Barcode({ className }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${BAR_TOTAL} 20`} preserveAspectRatio="none" className={className} fill="#1e2330" aria-hidden="true">
      {BARS.map((width, index) =>
        index % 2 === 0 ? <rect key={index} x={BAR_OFFSETS[index]} y={0} width={width} height={20} /> : null,
      )}
    </svg>
  );
}

/**
 * The hero composition: a curled paper receipt with two reward cards.
 * Built from HTML, CSS and SVG — the text is real text.
 */
export function HeroArt({ className = "" }: { className?: string }) {
  return (
    <div
      className={`art ${className}`}
      role="img"
      aria-label="A paper receipt from Apple beside two AAPL tokenized stock reward cards"
    >
      <div className="art-float-a absolute inset-0">
        <div className="art-receipt">
          <svg className="art-curl" viewBox="0 0 130 310" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="curl-shade" x1="0" y1="0" x2="1" y2="0.25">
                <stop offset="0" stopColor="#fbf8ee" />
                <stop offset="0.35" stopColor="#e9e3d2" />
                <stop offset="1" stopColor="#cbc4af" />
              </linearGradient>
              <linearGradient id="curl-fade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0.55" stopColor="#000" stopOpacity="0" />
                <stop offset="1" stopColor="#5a4c20" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <path d="M0 6C38-4 92 0 112 22c22 26 14 150-36 284C70 222 66 96 0 6Z" fill="url(#curl-shade)" />
            <path d="M0 6C38-4 92 0 112 22c22 26 14 150-36 284C70 222 66 96 0 6Z" fill="url(#curl-fade)" />
          </svg>

          <div className="paper">
            <div className="paper-brand">
              <LogoMark />
              <span>shareback</span>
            </div>

            <div className="paper-merchant">
              <BrandMark company="apple" />
              <span>APPLE</span>
            </div>

            <div className="paper-mono mt-[2.4cqw]">
              <div className="paper-row italic">
                <span>Sep 14, 2026</span>
                <span>San Francisco, CA</span>
              </div>
              <div className="paper-rule" />
              <div className="paper-row italic">
                <span>MacBook Air</span>
                <span>$1,099.00</span>
              </div>
              <div className="paper-row italic">
                <span>USB-C Charger</span>
                <span>$49.00</span>
              </div>
              <div className="paper-row italic">
                <span>AppleCare+</span>
                <span>$149.00</span>
              </div>
              <div className="paper-rule" />
              <div className="paper-row paper-total italic">
                <span>Total</span>
                <span>$1,297.00</span>
              </div>
            </div>

            <Barcode className="paper-barcode" />
            <p className="paper-thanks">THANK YOU FOR SHOPPING</p>
          </div>
        </div>
      </div>

      <div className="art-card art-card-lime">
        <BrandMark company="apple" className="h-[5cqw] w-[5cqw]" />
        <p className="art-card-ticker mt-[2.4cqw]">AAPL</p>
        <p className="art-card-kind mt-[0.6cqw]">Tokenized stock</p>
      </div>

      <div className="art-card art-card-forest">
        <BrandMark company="apple" className="h-[5.2cqw] w-[5.2cqw]" />
        <p className="art-card-ticker mt-[2.2cqw]">AAPL</p>
        <p className="art-card-kind mt-[0.7cqw]">Tokenized stock</p>
        <TrendIcon className="mt-[0.8cqw] h-[2.8cqw] w-[2.8cqw] opacity-80" />
        <span className="art-card-amount">+0.005 AAPL</span>
      </div>
    </div>
  );
}

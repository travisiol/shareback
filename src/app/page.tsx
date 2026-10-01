import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { HeroArt } from "@/components/home/HeroArt";
import { SiteHeader } from "@/components/home/SiteHeader";
import { ArrowRight, BagIcon, BarsIcon, CheckIcon, PlusIcon, ReceiptIcon, UploadIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { COMPANIES } from "@/config/eligibility";
import { CHAIN } from "@/config/network";
import { LIVE_POLICY } from "@/config/reward-policy";
import { REVIEW_PROMISE, REWARD_PROMISE } from "@/config/service";
import { FILE_RETENTION_DAYS_AFTER_DECISION } from "@/config/uploads";

const STEPS = [
  {
    n: "01",
    Icon: BagIcon,
    title: "Shop your favorite brands",
    body: "Make everyday purchases at eligible stores.",
  },
  {
    n: "02",
    Icon: ReceiptIcon,
    title: "Upload your receipt",
    body: "Scan and submit your receipt in seconds.",
  },
  {
    n: "03",
    Icon: BarsIcon,
    title: "Collect stock rewards",
    body: "Claim tokenized stock in the company you shopped.",
  },
];

const liveCompanies = new Set(LIVE_POLICY.campaigns.filter((c) => c.active).map((c) => c.companyKey));

const FAQ = [
  {
    q: "Is a reward the same as owning shares?",
    a: `No. Rewards are tokenized stock: tokens on ${CHAIN.name} that track a company's stock. Holding one is not the same as holding conventional shares in a brokerage account — rights, protections and availability differ, and the value can go down as well as up. Read the token issuer's terms before you rely on it.`,
  },
  {
    q: "Who pays for the rewards?",
    a: "SHAREBACK does, from a reward pool it funds itself. The companies shown here do not sponsor, endorse or fund rewards. Their names only identify where a purchase was made.",
  },
  {
    q: "How much will I get?",
    a: "There is no fixed rate and no guaranteed return. Each campaign sets fixed token quantities, a cap per receipt and a total budget. You see an amount only once a reward has actually been reserved for your receipt, and a campaign can run out.",
  },
  {
    q: "Which receipts are eligible?",
    a: `Eligibility follows the merchant on the receipt — the seller — not the brands of the products on it. An Apple product bought from a marketplace is a receipt from that marketplace, so it does not qualify for an Apple reward. Receipts must be submitted within ${LIVE_POLICY.maxReceiptAgeDays} days of purchase.`,
  },
  {
    q: "What happens to my receipt?",
    a: `It is stored privately, visible only to you and to the reviewer who checks it. Receipt images and purchase details are never written to a blockchain. You can delete a receipt before you claim, and the file is removed ${FILE_RETENTION_DAYS_AFTER_DECISION} days after a final decision.`,
  },
  {
    q: "How long does it take?",
    a: `${REVIEW_PROMISE} ${REWARD_PROMISE}`,
  },
  {
    q: "Do I need a wallet?",
    a: "Yes, to submit a receipt and to claim. You sign a one-time message to prove the wallet is yours — it costs no gas and moves no funds. Claimed rewards arrive in that same wallet.",
  },
];

export default function Home() {
  return (
    <>
      <div className="relative overflow-x-clip">
        <SiteHeader />

        <main id="top">
          {/* ───────────── hero */}
          <section className="shell relative pb-10 lg:min-h-[37.4rem] lg:pb-0">
            <div className="relative z-10 pt-8 sm:pt-12 lg:pt-[3.9rem]">
              <h1 className="display rise text-[clamp(3.05rem,13.4vw,5.6rem)] lg:text-[clamp(4.6rem,7.32vw,7.1rem)]">
                You bought it.
                <br />
                Now own
                <br />a piece.
              </h1>
              <p
                className="rise mt-7 max-w-[34rem] text-[clamp(1.2rem,1.78vw,1.7rem)] leading-snug tracking-[-0.01em] lg:mt-[1.85rem] lg:max-w-none"
                style={{ "--delay": "80ms" } as React.CSSProperties}
              >
                Turn eligible receipts into tokenized stock rewards.
              </p>
              <div
                className="rise mt-7 flex flex-wrap items-center gap-x-9 gap-y-5 lg:mt-[1.6rem]"
                style={{ "--delay": "160ms" } as React.CSSProperties}
              >
                <Link href="/app" className="btn btn-lime btn-xl w-full sm:w-auto">
                  <UploadIcon className="size-[1.9rem]" strokeWidth={1.9} />
                  Scan your receipt
                </Link>
                <a href="#how" className="link-arrow">
                  See how it works
                  <ArrowRight className="size-[1.35rem]" strokeWidth={1.8} />
                </a>
              </div>
            </div>

            <HeroArt className="rise mx-auto mt-6 w-[min(112%,34rem)] max-w-none -translate-x-[6%] sm:-translate-x-0 lg:absolute lg:-top-[5.25rem] lg:-right-[1.5%] lg:mt-0 lg:w-[54.5%]" />
          </section>

          {/* ───────────── three steps */}
          <section id="how" aria-label="How it works" className="shell relative z-10 lg:mt-[2rem]">
            <ol className="grid border-t border-line md:grid-cols-3">
              {STEPS.map(({ n, Icon, title, body }, index) => (
                <li
                  key={n}
                  className={`reveal flex items-start gap-5 py-7 md:py-[1.9rem] ${
                    index > 0 ? "border-t border-line md:border-t-0 md:border-l md:pl-[3.1rem]" : ""
                  }`}
                >
                  <span className="mt-[0.95rem] w-7 shrink-0 text-[1.0625rem] font-extrabold">{n}</span>
                  <Icon className="mt-1 h-[4.2rem] w-[3.4rem] shrink-0" strokeWidth={2.6} />
                  <div className="pl-1.5">
                    <h2 className="text-[1.3125rem] leading-tight font-bold tracking-[-0.015em]">{title}</h2>
                    <p className="mt-2 max-w-[15.5rem] text-[1.0625rem] leading-snug text-moss">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </main>
      </div>

      {/* ───────────── forest panel */}
      <section className="on-forest grain mx-[clamp(0.5rem,1.85vw,1.75rem)] mt-4 overflow-hidden rounded-[clamp(1.75rem,3vw,2.5rem)] bg-forest text-paper lg:mt-[0.9rem]">
        <div className="shell py-[clamp(3rem,5.4vw,5rem)]">
          <div>
            <h2 className="display reveal text-[clamp(2.6rem,5.75vw,5.55rem)]">
              Your purchases. <br className="lg:hidden" />
              Your stake.
            </h2>
            <p className="reveal mt-6 max-w-[40rem] text-[clamp(1.0625rem,1.4vw,1.3125rem)] leading-relaxed text-paper/80">
              A receipt is proof you chose a company. SHAREBACK turns a verified one into a small tokenized stock reward
              in that same company — paid from our own reward pool.
            </p>
          </div>

          {/* receipt → review → reward */}
          <div className="mt-[clamp(2.5rem,5vw,4.5rem)] grid gap-10 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center md:gap-0">
            <figure className="reveal">
              <div className="journey-pop mx-auto w-[min(100%,17rem)] -rotate-3 rounded-t-[14px] bg-paper px-6 pt-6 pb-8 text-forest shadow-lift [clip-path:polygon(0_0,100%_0,100%_calc(100%-9px),95%_100%,90%_calc(100%-9px),85%_100%,80%_calc(100%-9px),75%_100%,70%_calc(100%-9px),65%_100%,60%_calc(100%-9px),55%_100%,50%_calc(100%-9px),45%_100%,40%_calc(100%-9px),35%_100%,30%_calc(100%-9px),25%_100%,20%_calc(100%-9px),15%_100%,10%_calc(100%-9px),5%_100%,0_calc(100%-9px))]">
                <div className="flex items-center gap-2.5">
                  <BrandMark company="apple" className="size-6" />
                  <span className="text-sm font-bold tracking-[0.14em]">APPLE</span>
                </div>
                <div className="mt-4 space-y-1.5 font-mono text-[0.8125rem]">
                  <div className="flex justify-between">
                    <span>MacBook Air</span>
                    <span>$1,099.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>AppleCare+</span>
                    <span>$149.00</span>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-forest/40 pt-1.5 font-medium">
                    <span>Total</span>
                    <span>$1,297.00</span>
                  </div>
                </div>
              </div>
              <figcaption className="mt-6 text-center">
                <p className="text-lg font-bold">You upload a receipt</p>
                <p className="mt-1 text-[0.9375rem] text-paper/70">A photo or a PDF. It stays private.</p>
              </figcaption>
            </figure>

            <div aria-hidden="true" className="journey-dash mx-auto hidden h-0.5 w-[clamp(2rem,6vw,5.5rem)] md:block" />

            <figure className="reveal">
              <div
                className="journey-pop mx-auto grid w-[min(100%,17rem)] place-items-center rounded-[24px] bg-forest-soft px-6 py-9 shadow-lift ring-1 ring-paper/10"
                style={{ "--delay": "1.8s" } as React.CSSProperties}
              >
                <span className="grid size-14 place-items-center rounded-full bg-lime text-forest">
                  <CheckIcon className="size-7" strokeWidth={2.6} />
                </span>
                <p className="mt-4 text-lg font-bold">Purchase verified</p>
                <p className="mt-1 text-center text-sm text-paper/70">Merchant, date and total checked by a reviewer</p>
              </div>
              <figcaption className="mt-6 text-center">
                <p className="text-lg font-bold">We review it</p>
                <p className="mt-1 text-[0.9375rem] text-paper/70">Within 2 hours of your upload.</p>
              </figcaption>
            </figure>

            <div aria-hidden="true" className="journey-dash mx-auto hidden h-0.5 w-[clamp(2rem,6vw,5.5rem)] md:block" />

            <figure className="reveal">
              <div
                className="journey-pop mx-auto w-[min(100%,17rem)] rotate-3 rounded-[24px] bg-lime px-6 py-6 text-forest shadow-lift"
                style={{ "--delay": "3.6s" } as React.CSSProperties}
              >
                <div className="flex items-start justify-between">
                  <BrandMark company="apple" className="size-7" />
                  <span className="text-xs font-semibold">Reward</span>
                </div>
                <p className="mt-5 text-[1.75rem] leading-none font-extrabold">+0.005 AAPL</p>
                <p className="mt-1.5 text-sm font-medium">Tokenized stock</p>
              </div>
              <figcaption className="mt-6 text-center">
                <p className="text-lg font-bold">You claim your reward</p>
                <p className="mt-1 text-[0.9375rem] text-paper/70">Sent right after approval.</p>
              </figcaption>
            </figure>
          </div>

          <ul className="mt-[clamp(2.5rem,5vw,4.5rem)] grid gap-x-10 gap-y-6 border-t border-paper/15 pt-8 text-[0.9375rem] leading-relaxed text-paper/75 md:grid-cols-3">
            <li>
              <strong className="block text-base text-paper">Funded by us, not by brands</strong>
              Rewards come from SHAREBACK&apos;s reward pool. The companies named here are not partners or sponsors.
            </li>
            <li>
              <strong className="block text-base text-paper">Tokenized stock, not a share certificate</strong>
              A reward is a token that tracks a stock. It is not direct ownership of conventional shares.
            </li>
            <li>
              <strong className="block text-base text-paper">No fixed rate, no promises</strong>
              Amounts are set per campaign and capped by its budget. Token values can fall as well as rise.
            </li>
          </ul>
        </div>
      </section>

      {/* ───────────── rewards */}
      <section id="rewards" className="shell py-[clamp(4rem,8vw,7.5rem)]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow reveal">Rewards</p>
            <h2 className="display reveal mt-3 text-[clamp(2.3rem,4.6vw,4.2rem)]">
              Shop there.
              <br />
              Hold a piece of it.
            </h2>
          </div>
          <p className="reveal max-w-[27rem] text-[1.0625rem] leading-relaxed text-moss">
            Buy directly from the company, upload the receipt, and hold a piece of it. Brand names show where a
            purchase was made — they are not partnerships.
          </p>
        </div>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMPANIES.map((company) => (
            <li key={company.key} className="card reveal flex flex-col p-6">
              <div className="flex items-start justify-between">
                <span className="grid size-14 place-items-center rounded-2xl bg-cream">
                  <BrandMark company={company.key} className="size-7" />
                </span>
                {liveCompanies.has(company.key) && <span className="badge badge-good">Campaign open</span>}
              </div>
              <h3 className="mt-5 text-[1.5rem] font-extrabold tracking-[-0.02em]">{company.name}</h3>
              <p className="mt-1 text-[0.9375rem] text-moss">{company.blurb}</p>
              <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-[0.9375rem]">
                <span className="text-moss">Reward token</span>
                <span className="font-mono font-medium">{company.tokenSymbol}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ───────────── FAQ */}
      <section id="faq" className="shell grid gap-10 pb-[clamp(4rem,8vw,7.5rem)] lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="eyebrow">Questions</p>
          <h2 className="display mt-3 text-[clamp(2.3rem,4.6vw,4.2rem)]">
            The honest
            <br />
            answers.
          </h2>
        </div>
        <div className="faq divide-y divide-line border-y border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex items-center justify-between gap-6 rounded-lg py-5 text-[1.25rem] font-bold tracking-[-0.01em]">
                {item.q}
                <PlusIcon className="faq-plus size-6 shrink-0" />
              </summary>
              <p className="max-w-[42rem] pb-6 text-[1.0625rem] leading-relaxed text-moss">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ───────────── closing call */}
      <section className="shell pb-[clamp(3rem,6vw,5rem)]">
        <div className="grain flex flex-col items-start justify-between gap-8 rounded-[clamp(1.75rem,3vw,2.5rem)] bg-lime px-[clamp(1.5rem,5vw,4.5rem)] py-[clamp(2.25rem,5vw,4rem)] md:flex-row md:items-center">
          <h2 className="display text-[clamp(2.2rem,4.4vw,4rem)]">
            Got a receipt?
            <br />
            Own a piece of it.
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/app" className="btn btn-forest btn-xl">
              Scan your receipt
            </Link>
          </div>
        </div>
      </section>

      <footer className="shell border-t border-line py-10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <Logo />
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-2 text-[0.9375rem] font-medium">
            <a href="#how" className="hover:underline">
              How it works
            </a>
            <a href="#rewards" className="hover:underline">
              Rewards
            </a>
            <a href="#faq" className="hover:underline">
              FAQ
            </a>
            <Link href="/app/dashboard" className="hover:underline">
              Dashboard
            </Link>
          </nav>
        </div>
        <p className="mt-8 max-w-[58rem] text-[0.8125rem] leading-relaxed text-moss">
          SHAREBACK rewards are tokenized stock tokens, not conventional shares, and are not investment advice. Rewards
          are discretionary, limited by campaign budgets and may be unavailable in your region. Token values can go down
          as well as up. Company names and marks belong to their owners and are used only to identify where a purchase
          was made; they do not imply sponsorship, endorsement or partnership.
        </p>
      </footer>
    </>
  );
}

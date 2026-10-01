import { Logo } from "../Logo";
import { WalletButton } from "../WalletDialog";

export function SiteHeader() {
  return (
    <header className="relative z-20">
      <div className="shell relative flex h-[5.25rem] items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-[3.75rem] text-[1.0625rem] font-medium md:flex lg:absolute lg:left-[40.3%]">
          <a href="#how" className="rounded-md underline-offset-8 hover:underline">
            How it works
          </a>
          <a href="#rewards" className="rounded-md underline-offset-8 hover:underline">
            Rewards
          </a>
        </nav>
        <WalletButton className="btn btn-forest btn-sm sm:min-h-[3.1rem] sm:px-[1.6rem] sm:text-base" />
      </div>
    </header>
  );
}

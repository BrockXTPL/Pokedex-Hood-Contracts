import { Link } from "wouter";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Database,
  ExternalLink,
  Github,
  Layers3,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IndexChart } from "@/components/IndexChart";
import { FundingWidget, type FundingSummary } from "@/components/FundingWidget";
import { trpc } from "@/lib/trpc";
import { BASE_SET_PROFILE_ALT, BASE_SET_PROFILE_IMAGE } from "@/lib/marketArtwork";
import { useAuth } from "@/_core/hooks/useAuth";

const displayNumber = (value: string | number | undefined, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(undefined, options).format(Number(value ?? 0));

const displayDate = (value: Date | string | null | undefined) => {
  if (!value) return "Awaiting first sync";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const shortenHash = (hash: string) => `${hash.slice(0, 7)}…${hash.slice(-5)}`;

const fallbackFunding: FundingSummary = {
  targetEth: "0.050000",
  confirmedEth: "0.000000",
  pendingEth: "0.000000",
  progressPercent: 0,
  contributorCount: 0,
  confirmedCount: 0,
};

type ContributionRefresh = {
  transactionHash: string;
  funding: FundingSummary;
  contributionStatus: "confirmed" | "pending" | "failed";
};

function StatusBadge({ network, lifecycle }: { network: string; lifecycle: string }) {
  const isTestnet = network === "testnet";
  const isLocked = lifecycle === "locked";
  return (
    <span className={`status-badge ${isLocked ? "status-locked" : isTestnet ? "status-testnet" : "status-mainnet"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {isLocked ? "Coming to Mainnet" : isTestnet ? "Testnet live" : "Mainnet"}
    </span>
  );
}

function Metric({ label, value, note, icon: Icon, tone = "amber" }: { label: string; value: string; note: string; icon: typeof Activity; tone?: "amber" | "cyan" | "violet" }) {
  const toneClasses = {
    amber: "bg-amber-200/10 text-amber-200",
    cyan: "bg-cyan-200/10 text-cyan-200",
    violet: "bg-violet-200/10 text-violet-200",
  };
  return (
    <div className="soft-card rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-white/43">{label}</p>
          <p className="display-font mt-3 text-xl font-semibold tracking-tight text-white sm:text-2xl">{value}</p>
          <p className="mt-2 text-xs text-white/43">{note}</p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClasses[tone]}`}><Icon className="h-4.5 w-4.5" /></div>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [activityMarketSlug, setActivityMarketSlug] = useState("base-set");
  const [fundingOverride, setFundingOverride] = useState<FundingSummary | null>(null);
  const [receiptAwaitingConfirmation, setReceiptAwaitingConfirmation] = useState<string | null>(null);
  const overview = trpc.market.overview.useQuery(undefined, { refetchInterval: 15_000 });
  const baseDetail = trpc.market.detail.useQuery({ slug: "base-set" }, { refetchInterval: 15_000 });
  const activityDetail = trpc.market.detail.useQuery({ slug: activityMarketSlug }, { refetchInterval: 15_000 });
  const baseMarket = overview.data?.find(market => market.slug === "base-set");
  const activityMarket = overview.data?.find(market => market.slug === activityMarketSlug);
  const futureMarkets = overview.data?.filter(market => market.slug !== "base-set") ?? [];
  const detail = baseDetail.data;
  const liveHistory = detail?.history ?? [];
  const archiveHistory = detail?.archiveHistory ?? [];
  const latest = detail?.latestSnapshot;
  const expectedComponentCount = detail?.components.filter(component => component.isActive).length ?? 16;
  const currentBasketValue = latest ? Number(latest.pricedSubtotalUsd) : null;
  const firstLiveBasketValue = liveHistory[0] ? Number(liveHistory[0].pricedSubtotalUsd) : null;
  const sameLiveCoverage = latest?.componentCount === liveHistory[0]?.componentCount;
  const liveBasketChange = currentBasketValue !== null && firstLiveBasketValue && sameLiveCoverage ? ((currentBasketValue - firstLiveBasketValue) / firstLiveBasketValue) * 100 : null;
  const providerUpdatedAt = latest?.providerUpdatedAt ?? null;
  const totalHistoricalObservations = archiveHistory.length + liveHistory.length;
  const serverFunding = detail?.market.funding ?? fallbackFunding;
  const funding = fundingOverride ?? serverFunding;
  const contract = detail?.contract ?? { isConfigured: false, chainId: 46630, liquidityPoolAddress: null, abi: [] };

  const refreshFundingViews = useCallback(async () => {
    await Promise.all([baseDetail.refetch(), overview.refetch(), activityDetail.refetch()]);
  }, [activityDetail, baseDetail, overview]);

  const handleContributionRecorded = useCallback(async (confirmation: ContributionRefresh) => {
    setFundingOverride(confirmation.funding);
    setReceiptAwaitingConfirmation(confirmation.contributionStatus === "pending" ? confirmation.transactionHash : null);
    await refreshFundingViews();
    if (confirmation.contributionStatus !== "pending") setFundingOverride(null);
  }, [refreshFundingViews]);

  useEffect(() => {
    if (!receiptAwaitingConfirmation) return;

    let cancelled = false;
    let retryTimer: number | undefined;
    let attempts = 0;
    const maxAttempts = 20;

    const refreshUntilFinal = async () => {
      const [detailResult] = await Promise.all([baseDetail.refetch(), overview.refetch(), activityDetail.refetch()]);
      if (cancelled) return;

      const refreshedDetail = detailResult.data;
      const receipt = refreshedDetail?.contributions.find(contribution => contribution.transactionHash.toLowerCase() === receiptAwaitingConfirmation.toLowerCase());
      if (refreshedDetail?.market.funding) setFundingOverride(refreshedDetail.market.funding);

      if (receipt?.status === "confirmed" || receipt?.status === "failed" || attempts >= maxAttempts) {
        setReceiptAwaitingConfirmation(null);
        setFundingOverride(null);
        return;
      }

      attempts += 1;
      retryTimer = window.setTimeout(refreshUntilFinal, 3_000);
    };

    retryTimer = window.setTimeout(refreshUntilFinal, 2_000);
    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [activityDetail, baseDetail, overview, receiptAwaitingConfirmation]);

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#10162a]/82 backdrop-blur-xl">
        <div className="container flex h-[72px] items-center justify-between gap-2 sm:gap-4">
          <a href="#top" className="group flex shrink-0 items-center gap-3" aria-label="Pokemon Index Markets home">
            <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-500 shadow-[0_0_24px_rgba(251,191,36,0.28)]">
              <div className="h-3.5 w-3.5 rounded-full border-[3px] border-slate-950 bg-amber-50" />
              <span className="absolute h-px w-full bg-slate-950/70" />
            </div>
            <div className="hidden sm:block">
              <p className="display-font text-sm font-bold tracking-tight text-white">POKEMON INDEX MARKETS</p>
              <p className="text-[10px] font-medium tracking-[0.12em] text-white/40">$POKEDEX · TESTNET</p>
            </div>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-white/58 md:flex">
            <a className="transition-colors hover:text-white" href="#index">Index</a>
            <a className="transition-colors hover:text-white" href="#funding">Funding</a>
            <a className="transition-colors hover:text-white" href="#markets">Markets</a>
            <a className="transition-colors hover:text-white" href="#methodology">Methodology</a>
            <Link className="transition-colors hover:text-white" href="/whitepaper">Whitepaper</Link>
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            {isAuthenticated && user?.role === "admin" && (
              <Link href="/admin"><Button variant="ghost" size="sm" className="hidden text-white/65 hover:bg-white/8 hover:text-white sm:inline-flex">Control room</Button></Link>
            )}
            <a href="https://github.com/BrockXTPL?tab=repositories" target="_blank" rel="noreferrer" aria-label="Open BrockXTPL GitHub repositories in a new tab" title="GitHub repositories"><Button variant="ghost" size="icon" className="h-9 w-9 text-white/68 hover:bg-white/[0.08] hover:text-white"><Github className="h-4.5 w-4.5" /></Button></a>
            <a href="#funding"><Button size="sm" className="h-9 bg-amber-300 px-3 text-slate-950 hover:bg-amber-200 sm:px-4">Fund testnet <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" /></Button></a>
            <Button
              variant="ghost"
              size="icon"
              className="text-white/60 md:hidden"
              aria-label={mobileNavigationOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileNavigationOpen}
              aria-controls="mobile-primary-navigation"
              onClick={() => setMobileNavigationOpen(open => !open)}
            >
              {mobileNavigationOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {mobileNavigationOpen && (
        <nav id="mobile-primary-navigation" aria-label="Mobile navigation" className="border-b border-white/[0.08] bg-[#10162a] px-4 py-3 md:hidden">
          <div className="container grid gap-1">
            {[
              ["Index", "#index"],
              ["Funding", "#funding"],
              ["Markets", "#markets"],
              ["Methodology", "#methodology"],
            ].map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMobileNavigationOpen(false)} className="rounded-lg px-3 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white">{label}</a>
            ))}
            <Link href="/whitepaper" onClick={() => setMobileNavigationOpen(false)} className="rounded-lg px-3 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white">Whitepaper</Link>
            <a href="https://github.com/BrockXTPL?tab=repositories" target="_blank" rel="noreferrer" onClick={() => setMobileNavigationOpen(false)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"><Github className="h-4 w-4" /> GitHub repositories <ExternalLink className="ml-auto h-3.5 w-3.5" /></a>
          </div>
        </nav>
      )}

      <main id="top">
        {(overview.isError || baseDetail.isError) && (
          <div role="alert" className="container pt-5">
            <div className="rounded-xl border border-rose-300/20 bg-rose-300/[0.08] px-4 py-3 text-sm text-rose-100">Market data is temporarily unavailable. The most recent confirmed data will return when the next refresh succeeds.</div>
          </div>
        )}
        <section className="market-grid relative isolate overflow-hidden border-b border-white/[0.07]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(68,135,225,0.18),transparent_70%)]" />
          <div className="container relative grid gap-10 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:py-20">
            <div className="reveal">
              <div className="flex flex-wrap items-center gap-2.5"><StatusBadge network="testnet" lifecycle={baseMarket?.lifecycle ?? "configuration_pending"} /><span className="status-badge status-ready"><ShieldCheck className="h-3.5 w-3.5" /> User-wallet controlled</span></div>
              <div className="mt-8 flex items-center gap-3"><img src={BASE_SET_PROFILE_IMAGE} alt={BASE_SET_PROFILE_ALT} className="h-10 w-10 rounded-xl border border-amber-200/30 object-cover shadow-[0_0_22px_rgba(251,191,36,0.22)]" /><p className="eyebrow"><Sparkles className="h-3.5 w-3.5" /> Original Pokémon Base Set</p></div>
              <h1 className="mt-4 max-w-4xl text-balance text-4xl font-semibold leading-[1.03] tracking-[-0.055em] text-white sm:text-5xl lg:text-6xl">A transparent price index for the cards that started it all.</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">Pokemon Index Markets tracks a defined basket of Base Set holofoils, records source-backed price observations, and proves the $Pokedex market workflow on Robinhood Chain testnet before any mainnet rollout.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#index"><Button className="h-11 bg-cyan-300 px-5 font-semibold text-slate-950 hover:bg-cyan-200">Explore Base Set index <ChevronRight className="ml-1.5 h-4 w-4" /></Button></a>
                <a href="#methodology"><Button variant="outline" className="h-11 border-white/15 bg-white/[0.03] px-5 text-white hover:bg-white/[0.08] hover:text-white">View methodology</Button></a>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-xs text-white/42"><span className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-cyan-200" /> 16 defined components</span><span className="flex items-center gap-2"><Database className="h-4 w-4 text-cyan-200" /> Source evidence persisted</span><span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-cyan-200" /> Mainnet locked</span></div>
            </div>

            <div className="surface-card reveal reveal-delay-1 relative overflow-hidden rounded-[1.6rem] p-5 sm:p-6">
              <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-cyan-300/12 blur-3xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-start gap-3"><img src={BASE_SET_PROFILE_IMAGE} alt="" aria-hidden="true" className="h-11 w-11 shrink-0 rounded-xl border border-amber-200/25 object-cover" /><div><p className="eyebrow"><Activity className="h-3.5 w-3.5" /> Base basket</p><p className="mt-3 text-sm text-white/48">$POKEDEX · BASE-TESTNET</p></div></div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-right"><p className="text-[10px] uppercase tracking-[0.12em] text-white/40">Oracle status</p><p className="mt-1 text-xs font-medium text-cyan-100">{latest ? "Recorded" : "Awaiting first run"}</p></div>
              </div>
              <div className="relative mt-10 flex items-end justify-between gap-3"><div><p className="display-font text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">{currentBasketValue === null ? "—" : `$${displayNumber(currentBasketValue, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p><p className="mt-2 text-sm text-white/45">Live subtotal · {latest ? `${latest.componentCount}/${expectedComponentCount}` : "—"} cards priced</p></div>{liveBasketChange !== null && <div className={`mb-1 flex items-center gap-1 text-sm font-medium ${liveBasketChange >= 0 ? "text-emerald-200" : "text-rose-200"}`}>{liveBasketChange >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{Math.abs(liveBasketChange).toFixed(2)}% <span className="text-[11px] font-normal text-white/42">vs. first live read</span></div>}</div>
              <div className="relative mt-8 grid grid-cols-2 gap-3 border-t border-white/[0.08] pt-5"><div><p className="text-[10px] uppercase tracking-[0.12em] text-white/38">Reference basket</p><p className="mt-1.5 text-sm font-medium text-white/85">Base Set holofoil</p></div><div><p className="text-[10px] uppercase tracking-[0.12em] text-white/38">Last local read</p><p className="mt-1.5 text-sm font-medium text-white/85">{displayDate(latest?.observedAt)}</p></div></div>
            </div>
          </div>
        </section>

        <section className="container py-10 sm:py-14">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Current live subtotal" value={currentBasketValue === null ? "—" : `$${displayNumber(currentBasketValue, { maximumFractionDigits: 2 })}`} note={latest ? `${latest.componentCount}/${expectedComponentCount} components priced; not a full-set total` : "First oracle sync pending"} icon={CircleDollarSign} tone="cyan" />
            <Metric label="Chart coverage" value={totalHistoricalObservations ? `${totalHistoricalObservations} points` : "—"} note={`${archiveHistory.length} archive · ${liveHistory.length} live`} icon={BarChart3} />
            <Metric label="Funding progress" value={`${funding.progressPercent.toFixed(1)}%`} note={`${funding.contributorCount} confirmed wallet${funding.contributorCount === 1 ? "" : "s"}`} icon={WalletCards} tone="violet" />
            <Metric label="Provider price timestamp" value={providerUpdatedAt ? displayDate(providerUpdatedAt) : "Pending"} note="Source-reported update time, not local polling" icon={Clock3} tone="cyan" />
          </div>
        </section>

        <section id="index" className="container scroll-mt-24 pb-10 sm:pb-14">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-3">
              <img src={BASE_SET_PROFILE_IMAGE} alt="" aria-hidden="true" className="mb-0.5 h-11 w-11 rounded-xl border border-amber-200/25 object-cover" />
              <div>
                <p className="eyebrow"><BarChart3 className="h-3.5 w-3.5" /> USD basket history</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Base Set, valued in USD over time</h2>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-6 text-white/45">The chart uses USD subtotals for priced components. Historical archive and current source observations share one view, but remain visibly separated by source and coverage.</p>
          </div>
          <div className="surface-card rounded-[1.5rem] p-5 sm:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white/85">Historical USD priced-card subtotal</p>
                <p className="mt-1 text-xs text-white/42">{totalHistoricalObservations ? `${archiveHistory.length} archive points · ${liveHistory.length} live observations` : "No historical observations yet"}</p>
              </div>
              <span className="status-badge status-testnet"><CircleDollarSign className="h-3.5 w-3.5" /> USD subtotal view</span>
            </div>
            <IndexChart archivePoints={archiveHistory} livePoints={liveHistory} />
            {totalHistoricalObservations >= 2 && (
              <div role="status" className="mt-5 flex gap-3 rounded-xl border border-cyan-200/12 bg-cyan-200/[0.045] p-4 text-sm leading-6 text-cyan-50/78">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-100" />
                <p><span className="font-medium text-cyan-50">Source boundary:</span> The amber historical backdrop is an archived TCGdex price-history proxy using 15 available <span className="font-medium">holo-good</span> components through September 2024. The cyan current observations are a live TCGdex / TCGplayer subtotal for {latest?.componentCount ?? 0} of {expectedComponentCount} configured holofoil components. Both segments show only their priced-card subtotals, not a complete Base Set collection total. The dashed connector is a source-transition guide, not a market-price observation. Latest live provider timestamp: {providerUpdatedAt ? displayDate(providerUpdatedAt) : "not supplied by the provider"}.</p>
              </div>
            )}
          </div>
        </section>

        <section id="funding" className="container scroll-mt-24 py-10 sm:py-14">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
            <div>
              <p className="eyebrow"><WalletCards className="h-3.5 w-3.5" /> Testnet funding</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Every contribution has a visible path to confirmation.</h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/54">Funds are initiated only from your connected wallet. The platform verifies the final testnet receipt, destination, amount, and sender before it counts a contribution in the launch progress.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-3"><div className="soft-card rounded-2xl p-4"><ShieldCheck className="h-5 w-5 text-cyan-200" /><p className="mt-4 text-sm font-medium text-white">Wallet first</p><p className="mt-2 text-xs leading-5 text-white/42">No custody or private-key handling.</p></div><div className="soft-card rounded-2xl p-4"><BadgeCheck className="h-5 w-5 text-cyan-200" /><p className="mt-4 text-sm font-medium text-white">Receipt verified</p><p className="mt-2 text-xs leading-5 text-white/42">Only matching successful transactions count.</p></div><div className="soft-card rounded-2xl p-4"><Activity className="h-5 w-5 text-cyan-200" /><p className="mt-4 text-sm font-medium text-white">Live display</p><p className="mt-2 text-xs leading-5 text-white/42">Funding progress refreshes in-page.</p></div></div>
            </div>
            <FundingWidget funding={funding} contract={contract} onContributionRecorded={handleContributionRecorded} />
          </div>
        </section>

        <section className="container pb-10 sm:pb-14" aria-labelledby="market-activity-heading">
          <div className="surface-card overflow-hidden rounded-[1.5rem]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-5 sm:px-7">
              <div className="flex items-center gap-3">
                {activityMarket?.slug === "base-set" && <img src={BASE_SET_PROFILE_IMAGE} alt="" aria-hidden="true" className="h-10 w-10 rounded-xl border border-amber-200/25 object-cover" />}
                <div><p id="market-activity-heading" className="text-lg font-semibold tracking-tight text-white">Market activity</p><p className="mt-1 text-sm text-white/43">Transaction history and funding status for each configured market</p></div>
              </div>
              <StatusBadge network={activityMarket?.network ?? "testnet"} lifecycle={activityMarket?.lifecycle ?? "configuration_pending"} />
            </div>
            <div role="tablist" aria-label="Market transaction history" className="flex gap-2 overflow-x-auto border-b border-white/[0.08] px-5 py-3 sm:px-7">
              {(overview.data ?? []).map(market => (
                <button
                  key={market.slug}
                  type="button"
                  role="tab"
                  id={`market-tab-${market.slug}`}
                  aria-controls={`market-panel-${market.slug}`}
                  aria-selected={activityMarketSlug === market.slug}
                  tabIndex={activityMarketSlug === market.slug ? 0 : -1}
                  onClick={() => setActivityMarketSlug(market.slug)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${activityMarketSlug === market.slug ? "bg-cyan-200 text-slate-950" : "bg-white/[0.045] text-white/55 hover:bg-white/[0.09] hover:text-white"}`}
                >
                  {market.displayName}
                </button>
              ))}
            </div>
            <div id={`market-panel-${activityMarketSlug}`} role="tabpanel" aria-labelledby={`market-tab-${activityMarketSlug}`} tabIndex={0} className="overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70 focus-visible:ring-inset">
              <table className="w-full min-w-[620px] text-left">
                <thead className="border-b border-white/[0.06] bg-white/[0.025] text-[10px] uppercase tracking-[0.12em] text-white/38"><tr><th className="px-5 py-3.5 font-medium sm:px-7">Wallet</th><th className="px-5 py-3.5 font-medium">Amount</th><th className="px-5 py-3.5 font-medium">Status</th><th className="px-5 py-3.5 font-medium">Timestamp</th><th className="px-5 py-3.5 font-medium">Transaction</th></tr></thead>
                <tbody>
                  {activityDetail.isLoading ? <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-white/42">Loading {activityMarket?.displayName ?? "market"} history…</td></tr>
                    : activityDetail.isError ? <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-rose-200">Unable to load this market’s transaction history. Please try again on the next refresh.</td></tr>
                    : activityDetail.data?.contributions.length ? activityDetail.data.contributions.map(item => <tr key={item.id} className="border-b border-white/[0.055] text-sm last:border-0"><td className="display-font px-5 py-4 text-white/75 sm:px-7">{shortenHash(item.walletAddress)}</td><td className="px-5 py-4 font-medium text-white">{item.amountEth} ETH</td><td className="px-5 py-4"><span className={`status-badge ${item.status === "confirmed" ? "status-ready" : item.status === "failed" ? "status-locked" : "status-testnet"}`}>{item.status}</span></td><td className="px-5 py-4 text-white/46">{displayDate(item.confirmedAt ?? item.recordedAt)}</td><td className="px-5 py-4"><span className="display-font text-xs text-cyan-200">{shortenHash(item.transactionHash)}</span></td></tr>)
                    : <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-white/42">{activityMarket?.lifecycle === "locked" ? "This Coming to Mainnet market is locked; no transaction history is available." : "No testnet contribution receipts have been recorded yet."}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="markets" className="container scroll-mt-24 py-10 sm:py-14">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow"><Layers3 className="h-3.5 w-3.5" /> Expansion track</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Three future markets, deliberately locked.</h2></div><p className="max-w-md text-sm leading-6 text-white/45">These are not active offerings. They become configurable only after the Base Set testnet path is validated and an owner explicitly authorizes the next stage.</p></div>
          <div className="grid gap-4 md:grid-cols-3">{futureMarkets.map((market, index) => <article key={market.slug} className="surface-card hover-lift relative overflow-hidden rounded-[1.45rem] p-5"><div className="absolute right-4 top-4 rounded-full bg-white/[0.045] px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-white/32">0{index + 1}</div><LockKeyhole className="h-5 w-5 text-white/34" /><p className="mt-8 text-lg font-semibold text-white">{market.displayName}</p><p className="mt-1 text-sm text-white/42">{market.setCode.toUpperCase()} · Future index basket</p><div className="mt-7"><StatusBadge network={market.network} lifecycle={market.lifecycle} /><div className="funding-track mt-4"><div className="funding-fill opacity-35" style={{ width: `${market.funding.progressPercent}%` }} /></div><p className="mt-3 text-xs text-white/40">{market.funding.confirmedEth} ETH committed. Funding remains locked until Base Set validation and owner authorization.</p></div><button type="button" onClick={() => { setActivityMarketSlug(market.slug); document.getElementById("market-activity-heading")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="mt-5 text-left text-xs font-medium text-cyan-200 transition-colors hover:text-cyan-100">View locked market history <ChevronRight className="inline h-3.5 w-3.5" /></button><div className="mt-4 border-t border-white/[0.08] pt-4 text-xs text-white/37">Coming to Mainnet</div></article>)}</div>
        </section>

        <section id="methodology" className="container scroll-mt-24 pb-14 sm:pb-20">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">              <div className="surface-card rounded-[1.5rem] p-6 sm:p-7"><p className="eyebrow"><Database className="h-3.5 w-3.5" /> Methodology</p><h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-white">A small, inspectable basket—not a black box.</h2><p className="mt-4 text-sm leading-6 text-white/52">The current testnet calculation records the selected Base Set holofoil components below with equal weights. Public values are shown as USD subtotals for the components that have a current provider price, never as a complete collection total when coverage is incomplete; normalized averages remain stored only for calculation auditability. Source payloads and calculation versions are persisted server-side.</p><div className="mt-6 rounded-2xl border border-cyan-200/12 bg-cyan-200/[0.05] p-4 text-sm leading-6 text-cyan-50/80">Current price inputs are retrieved from TCGdex’s market data surface, with the provider’s stated price field and timestamp recorded alongside each calculation. The earlier chart backdrop is a separately labelled public TCGdex archive with different 15-card, holo-good coverage; it is never blended into the live 16-card series.</div></div><div className="surface-card overflow-hidden rounded-[1.5rem]"><div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-5 sm:px-7"><div><p className="text-lg font-semibold text-white">Component composition</p><p className="mt-1 text-sm text-white/42">Approved Base Set card universe</p></div><p className="display-font text-xs text-white/45">{detail?.components.length ?? 16} cards</p></div><div className="grid max-h-[410px] grid-cols-1 overflow-y-auto sm:grid-cols-2">{detail?.components.map(component => <div key={component.id} className="flex items-center justify-between gap-3 border-b border-white/[0.055] px-5 py-3.5 last:border-0 sm:px-6"><div className="min-w-0"><p className="truncate text-sm font-medium text-white/86">{component.cardName}</p><p className="mt-0.5 text-xs text-white/38">#{component.cardNumber} · {component.approvedVariant}</p></div><p className="display-font shrink-0 text-xs text-amber-200">{(Number(component.weight) * 100).toFixed(2)}%</p></div>) ?? <div className="col-span-2 p-8 text-center text-sm text-white/40">Loading approved components…</div>}</div></div></div>
        </section>
      </main>

      <footer className="border-t border-white/[0.08] bg-black/15"><div className="container flex flex-col gap-4 py-7 text-xs text-white/38 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} Pokemon Index Markets · $Pokedex testnet research interface</p><div className="flex flex-wrap gap-x-5 gap-y-2"><span>Not financial advice</span><span>No mainnet deployment enabled</span><span>Owner authorization required</span></div></div></footer>
    </div>
  );
}

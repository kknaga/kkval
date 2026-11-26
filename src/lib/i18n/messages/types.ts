import type { EntityClass, HealthVerdict, MarginTrend } from "@/db/schema";

export interface Messages {
  meta: {
    siteTitle: string;
    siteDescription: string;
    companyTitle: string;
    companyDescription: string;
    compareTitle: string;
    compareDescription: string;
    screenIndexTitle: string;
    screenIndexDescription: string;
    methodologyTitle: string;
  };
  nav: {
    subtitle: string;
    searchPlaceholder: string;
    searchButton: string;
    screeners: string;
    compare: string;
    methodology: string;
    languageLabel: string;
    switchToDark: string;
    switchToLight: string;
  };
  home: {
    eyebrow: string;
    headline: string;
    subhead: string;
    companiesIndexed: string;
    screenersHeading: string;
    watchlistHeading: string;
    watchlistSub: string;
    insidersHeading: string;
    insidersSub: string;
    compareHeading: string;
    viewAllScreeners: string;
  };
  verdict: Record<HealthVerdict, string>;
  entityClass: Record<EntityClass, string>;
  marginTrend: Record<MarginTrend, string>;
  company: {
    healthCheckTitle: string;
    cashRunway: string;
    cashFlowPositive: string;
    notApplicableSector: string;
    monthsSuffix: string;
    quarterlyBurn: string;
    totalLiquidity: string;
    shareDilution1y: string;
    shareDilution3y: string;
    reverseSplitFlag: string;
    debtVsCash: string;
    ttmFreeCashFlow: string;
    offeringFilings12m: string;
    compareWith: string;
    comparePlaceholder: string;
    compareGo: string;
    chartsTitle: string;
    annual: string;
    quarterly: string;
    revenueAndIncome: string;
    cashVsDebt: string;
    cashFlowAndFcf: string;
    shareCountTrend: string;
    insidersTitle: string;
    openMarketOnly: string;
    includeAllTx: string;
    noInsiders: string;
    insiderBuy: string;
    insiderSell: string;
    insiderOther: string;
    colDate: string;
    colInsider: string;
    colRole: string;
    colType: string;
    colShares: string;
    colPrice: string;
    colValue: string;
    colFiling: string;
    fundsTitle: string;
    noFunds: string;
    colManager: string;
    colQuarter: string;
    colPositionValue: string;
    filingsTitle: string;
    dilutionBadge: string;
    provenanceTitle: string;
    provenanceNote: string;
    peerCompareTitle: string;
    metricRevenue: string;
    metricNetIncome: string;
    metricCash: string;
    metricDebt: string;
    metricOcf: string;
    metricFcf: string;
    metricCapex: string;
    metricShares: string;
    faqTitle: string;
  };
  compare: {
    heading: string;
    subheading: string;
    metricCol: string;
    winner: string;
    tie: string;
    notFound: string;
    tryPair: string;
  };
  screen: {
    indexTitle: string;
    indexSub: string;
    companiesCount: string;
    colTicker: string;
    colCompany: string;
    colRunway: string;
    colDilution1y: string;
    colLiquidity: string;
    colFcfTtm: string;
    colVerdict: string;
    empty: string;
    cards: Record<
      | "small-caps-under-12-months-cash"
      | "highest-share-dilution-small-caps"
      | "cash-rich-debt-free-small-caps"
      | "recent-insider-buying-small-caps"
      | "positive-free-cash-flow-small-caps"
      | "foreign-adrs-financial-health",
      { title: string; description: string }
    >;
  };
  warnings: {
    runway_critical: string;
    runway_short: string;
    runway_watch: string;
    cash_flow_positive: string;
    heavy_dilution: string;
    moderate_dilution: string;
    possible_reverse_split: string;
    offering_filings_active: string;
    high_debt_to_cash: string;
    net_cash_surplus: string;
    margin_compressing: string;
    insider_buying_cluster: string;
    insider_heavy_selling: string;
    sector_excluded_spac: string;
    sector_excluded_financial: string;
  };
  footer: {
    methodology: string;
    privacy: string;
    terms: string;
    disclaimer: string;
  };
}

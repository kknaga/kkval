import type { HealthSummaryData, HealthWarning } from "@/db/schema";
import { formatCompactCurrency, formatPercent, normalizeLocaleSlug } from "@/lib/i18n/locales";
import { deMessages } from "./de";
import { enMessages } from "./en";
import { esMessages } from "./es";
import { jaMessages } from "./ja";
import { koMessages } from "./ko";
import { ptMessages } from "./pt";
import type { Messages } from "./types";
import { zhTwMessages } from "./zh-tw";

const DICTIONARIES: Record<string, Messages> = {
  en: enMessages,
  es: esMessages,
  ko: koMessages,
  pt: ptMessages,
  ja: jaMessages,
  "zh-tw": zhTwMessages,
  de: deMessages,
};

export type { Messages };

export function getMessages(locale: string | null | undefined): Messages {
  const normalized = normalizeLocaleSlug(locale) ?? "en";
  return DICTIONARIES[normalized] ?? enMessages;
}

export function formatMessage(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : `{${key}}`,
  );
}

export function renderHealthWarning(
  warning: HealthWarning,
  locale: string,
): string {
  const msg = getMessages(locale);
  const template = msg.warnings[warning.code];
  return formatMessage(template, warning.params ?? {});
}

export function renderHealthSummary(
  data: HealthSummaryData,
  locale: string,
): string {
  const norm = normalizeLocaleSlug(locale) ?? "en";
  const liq = formatCompactCurrency(
    data.totalLiquidityNative ?? data.totalLiquidityUsd,
    data.currency || "USD",
    norm,
  );
  const runway =
    data.cashRunwayMonths !== null ? data.cashRunwayMonths.toFixed(1) : null;
  const dil =
    data.shareDilution1yPct !== null
      ? formatPercent(data.shareDilution1yPct)
      : null;

  if (data.entityClass === "spac") {
    return {
      en: `${data.name} (${data.ticker}) is classified as a SPAC / blank-check vehicle holding ${liq} in liquid cash and equivalents. Operating cash runway and revenue multiples do not apply until a business combination closes.`,
      es: `${data.name} (${data.ticker}) está clasificada como SPAC con ${liq} en liquidez. Las métricas operativas de meses de caja no aplican hasta completar una fusión.`,
      ko: `${data.name} (${data.ticker})은(는) SPAC(기업인수목적회사)로 분류되며 유동성 ${liq}을(를) 보유하고 있습니다. 합병 완료 전까지 일반 영업 현금 런웨이 지표는 적용되지 않습니다.`,
      pt: `${data.name} (${data.ticker}) é classificada como SPAC com ${liq} em liquidez. Métricas operacionais de caixa não se aplicam até a fusão.`,
      ja: `${data.name} (${data.ticker}) はSPACに分類され、手元流動性は ${liq} です。事業統合完了まで通常のキャッシュランウェイ指標は適用されません。`,
      "zh-tw": `${data.name} (${data.ticker}) 分類為 SPAC 公司，帳上流動性為 ${liq}。完成併購前不適用一般營運現金跑道指標。`,
      de: `${data.name} (${data.ticker}) ist ein SPAC mit ${liq} Liquidität. Operative Cash-Runway-Kennzahlen gelten erst nach Abschluss einer Fusion.`,
    }[norm]!;
  }

  if (data.entityClass === "financial") {
    return {
      en: `${data.name} (${data.ticker}) is a financial institution reporting ${liq} in cash and equivalents. Traditional cash-burn runway and debt-to-cash checks are excluded because deposits and borrowings represent core banking balance-sheet items.`,
      es: `${data.name} (${data.ticker}) es una institución financiera con ${liq} en efectivo. Los cálculos tradicionales de quema de caja y deuda/efectivo se excluyen para bancos.`,
      ko: `${data.name} (${data.ticker})은(는) 금융기관으로 분류되며 현금성 자산 ${liq}을(를) 보고했습니다. 은행 업종 특성상 현금 소진 런웨이 및 부채/현금 비율 평가는 제외됩니다.`,
      pt: `${data.name} (${data.ticker}) é uma instituição financeira com ${liq} em caixa. Cálculos tradicionais de queima de caixa são excluídos para bancos.`,
      ja: `${data.name} (${data.ticker}) は金融機関であり、現金同等物は ${liq} です。銀行業のため通常の資金消費ランウェイ評価は対象外です。`,
      "zh-tw": `${data.name} (${data.ticker}) 為金融機構，帳上現金與約當現金為 ${liq}，因銀行資產負債結構不同而排除現金跑道評估。`,
      de: `${data.name} (${data.ticker}) ist ein Finanzinstitut mit ${liq} liquiden Mitteln. Klassische Cash-Burn-Kennzahlen sind für Banken ausgeschlossen.`,
    }[norm]!;
  }

  const runwayPhrase: Record<string, string> = {
    en: data.isCashFlowPositive
      ? `holds ${liq} in cash & short-term investments and generates positive operating cash flow`
      : runway
        ? `holds ${liq} in liquid reserves, implying ~${runway} months of cash runway at its trailing burn rate`
        : `holds ${liq} in cash & short-term investments`,
    es: data.isCashFlowPositive
      ? `cuenta con ${liq} en liquidez y genera flujo de caja operativo positivo`
      : runway
        ? `cuenta con ${liq} en liquidez, lo que equivale a ~${runway} meses de efectivo al ritmo actual`
        : `cuenta con ${liq} en liquidez`,
    ko: data.isCashFlowPositive
      ? `현금성 자산 ${liq}을(를) 보유하고 있으며 영업현금흐름이 플러스입니다`
      : runway
        ? `현금성 자산 ${liq}을(를) 보유 중이며 현재 소진 속도 기준 약 ${runway}개월의 현금 런웨이를 확보하고 있습니다`
        : `현금성 자산 ${liq}을(를) 보유하고 있습니다`,
    pt: data.isCashFlowPositive
      ? `possui ${liq} em liquidez e gera fluxo de caixa operacional positivo`
      : runway
        ? `possui ${liq} em liquidez, indicando ~${runway} meses de autonomia no ritmo atual`
        : `possui ${liq} em liquidez`,
    ja: data.isCashFlowPositive
      ? `手元流動性 ${liq} を保有し、営業キャッシュフローは黒字です`
      : runway
        ? `手元流動性 ${liq} を保有しており、現在の消費ペースで約 ${runway} ヶ月分の資金余力があります`
        : `手元流動性 ${liq} を保有しています`,
    "zh-tw": data.isCashFlowPositive
      ? `持有 ${liq} 流動資金且營運現金流為正`
      : runway
        ? `持有 ${liq} 流動資金，依目前燒錢速度預估約有 ${runway} 個月現金跑道`
        : `持有 ${liq} 流動資金`,
    de: data.isCashFlowPositive
      ? `verfügt über ${liq} Liquidität und erzielt einen positiven operativen Cashflow`
      : runway
        ? `verfügt über ${liq} Liquidität, was rund ${runway} Monaten Cash-Runway entspricht`
        : `verfügt über ${liq} Liquidität`,
  };

  const dilPhrase: Record<string, string> = {
    en: data.possibleReverseSplit
      ? `A sharp share-count drop was detected (possible reverse split).`
      : dil
        ? `Share count changed ${dil} year-over-year, with ${data.offeringFilings12m} shelf/offering filing(s) in the last 12 months.`
        : `${data.offeringFilings12m} shelf/offering filing(s) were submitted in the last 12 months.`,
    es: data.possibleReverseSplit
      ? `Se detectó una caída brusca en acciones (posible reverse split).`
      : dil
        ? `El número de acciones varió ${dil} interanualmente, con ${data.offeringFilings12m} registro(s) de emisión en 12 meses.`
        : `Se registraron ${data.offeringFilings12m} emisiones/shelf en los últimos 12 meses.`,
    ko: data.possibleReverseSplit
      ? `급격한 주식 수 감소(액면병합 가능성)가 감지되었습니다.`
      : dil
        ? `주식 수는 전년 대비 ${dil} 변동했으며 최근 12개월간 유상증자·선반등록 공시가 ${data.offeringFilings12m}건 있습니다.`
        : `최근 12개월간 유상증자·선반등록 공시가 ${data.offeringFilings12m}건 있습니다.`,
    pt: data.possibleReverseSplit
      ? `Queda abrupta no número de ações detectada (possível grupamento).`
      : dil
        ? `As ações variaram ${dil} em 12 meses, com ${data.offeringFilings12m} registro(s) de oferta no período.`
        : `Houve ${data.offeringFilings12m} registro(s) de oferta nos últimos 12 meses.`,
    ja: data.possibleReverseSplit
      ? `株式数の急減（株式併合の可能性）が検出されました。`
      : dil
        ? `発行済株式数は前年比 ${dil} 変動し、過去12ヶ月の増資関連提出は ${data.offeringFilings12m} 件です。`
        : `過去12ヶ月の増資関連提出は ${data.offeringFilings12m} 件です。`,
    "zh-tw": data.possibleReverseSplit
      ? `偵測到股數驟降（可能為反分割）。`
      : dil
        ? `股數年變動 ${dil}，近 12 個月共有 ${data.offeringFilings12m} 筆增資或註冊申報。`
        : `近 12 個月共有 ${data.offeringFilings12m} 筆增資或註冊申報。`,
    de: data.possibleReverseSplit
      ? `Ein starker Rückgang der Aktienanzahl (möglicher Reverse Split) wurde erkannt.`
      : dil
        ? `Die Aktienanzahl veränderte sich um ${dil} zum Vorjahr bei ${data.offeringFilings12m} Kapitalmaßnahmen-Filings in 12 Monaten.`
        : `In den letzten 12 Monaten gab es ${data.offeringFilings12m} Kapitalmaßnahmen-Filings.`,
  };

  const insiderPhrase: Record<string, string> = {
    en: `Form 4 filings over the last 90 days show ${data.insiderBuyCount90d} open-market buy(s) and ${data.insiderSellCount90d} sale(s).`,
    es: `Los reportes Form 4 de los últimos 90 días muestran ${data.insiderBuyCount90d} compra(s) y ${data.insiderSellCount90d} venta(s) en mercado abierto.`,
    ko: `최근 90일 Form 4 공시 기준 장내 매수 ${data.insiderBuyCount90d}건, 매도 ${data.insiderSellCount90d}건이 보고되었습니다.`,
    pt: `Os arquivos Form 4 nos últimos 90 dias mostram ${data.insiderBuyCount90d} compra(s) e ${data.insiderSellCount90d} venda(s) a mercado.`,
    ja: `過去90日間のForm 4では市場買付 ${data.insiderBuyCount90d} 件・売却 ${data.insiderSellCount90d} 件が報告されています。`,
    "zh-tw": `近 90 天 Form 4 顯示公開市場買進 ${data.insiderBuyCount90d} 筆、賣出 ${data.insiderSellCount90d} 筆。`,
    de: `Form-4-Meldungen der letzten 90 Tage zeigen ${data.insiderBuyCount90d} Marktkäufe und ${data.insiderSellCount90d} Verkäufe.`,
  };

  return `${data.name} (${data.ticker}) ${runwayPhrase[norm]} ${dilPhrase[norm]} ${insiderPhrase[norm]}`;
}

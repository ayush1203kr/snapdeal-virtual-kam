type MetricSnapshot = {
  visits: number;
  orders: number;
  revenue: number;
  inStockPct: number;
  cancellationPct: number;
  rating: number;
  returnPct: number;
};

type ProductSnapshot = {
  name: string;
  sku?: string;
  stock: number;
  views?: number;
  orders?: number;
  price?: number;
  rating?: number;
};

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const percentageChange = (current: number, previous: number) =>
  previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / Math.abs(previous)) * 100;

const formatChange = (value: number | null) =>
  value === null ? "No comparable baseline" : `${value > 0 ? "+" : ""}${value.toFixed(1)}% vs previous 30 days`;

export function analyzeSeller(seller: any) {
  const previous = seller?.metrics?.previous ?? {};
  const current = seller?.metrics?.current ?? {};
  const hasCurrentStockMetric = current.inStockPct !== undefined && current.inStockPct !== null && current.inStockPct !== "";
  const p = {
    visits: safeNumber(previous.visits),
    orders: safeNumber(previous.orders),
    revenue: safeNumber(previous.revenue),
    inStockPct: safeNumber(previous.inStockPct),
    cancellationPct: safeNumber(previous.cancellationPct),
    rating: safeNumber(previous.rating),
    returnPct: safeNumber(previous.returnPct)
  } as MetricSnapshot;
  const c = {
    visits: safeNumber(current.visits),
    orders: safeNumber(current.orders),
    revenue: safeNumber(current.revenue),
    inStockPct: safeNumber(current.inStockPct),
    cancellationPct: safeNumber(current.cancellationPct),
    rating: safeNumber(current.rating),
    returnPct: safeNumber(current.returnPct)
  } as MetricSnapshot;

  const previousConversion = p.visits > 0 ? (p.orders / p.visits) * 100 : 0;
  const currentConversion = c.visits > 0 ? (c.orders / c.visits) * 100 : 0;
  const previousAov = p.orders > 0 ? p.revenue / p.orders : 0;
  const currentAov = c.orders > 0 ? c.revenue / c.orders : 0;
  const changes = {
    revenue: percentageChange(c.revenue, p.revenue),
    orders: percentageChange(c.orders, p.orders),
    visits: percentageChange(c.visits, p.visits),
    conversion: percentageChange(currentConversion, previousConversion),
    averageOrderValue: percentageChange(currentAov, previousAov)
  };
  const products: ProductSnapshot[] = Array.isArray(seller?.products) ? seller.products : [];
  const unavailableProducts = products
    .filter(product => safeNumber(product.stock) <= 0)
    .sort((a, b) => safeNumber(b.views) - safeNumber(a.views));
  const lowStockProducts = products
    .filter(product => safeNumber(product.stock) > 0 && safeNumber(product.stock) <= 10)
    .sort((a, b) => safeNumber(b.views) - safeNumber(a.views));
  const stockRiskProducts = [...unavailableProducts, ...lowStockProducts]
    .sort((a, b) => safeNumber(b.views) - safeNumber(a.views));
  const signals: any[] = [];

  if (changes.visits !== null && changes.visits <= -8) {
    signals.push({
      key: "traffic",
      title: "Fewer shoppers are reaching your listings",
      detail: `Visits moved from ${p.visits.toLocaleString("en-IN")} to ${c.visits.toLocaleString("en-IN")} (${changes.visits.toFixed(1)}%). Check listing visibility, search relevance and traffic sources.`,
      severity: changes.visits <= -20 ? "critical" : "warning",
      evidence: { previous: p.visits, current: c.visits, changePct: changes.visits }
    });
  }

  if (changes.conversion !== null && changes.conversion <= -8) {
    signals.push({
      key: "conversion",
      title: "A smaller share of visitors is placing orders",
      detail: `Conversion moved from ${previousConversion.toFixed(2)}% to ${currentConversion.toFixed(2)}% (${(currentConversion - previousConversion).toFixed(2)} percentage points). Review availability, price competitiveness, listing clarity and delivery promise.`,
      severity: changes.conversion <= -20 ? "critical" : "warning",
      evidence: { previousPct: previousConversion, currentPct: currentConversion, changePct: changes.conversion }
    });
  }

  if (hasCurrentStockMetric && c.inStockPct < 90) {
    signals.push({
      key: "stock",
      title: "Product availability is restricting order capture",
      detail: `${c.inStockPct}% of the catalogue is in stock. ${unavailableProducts.length ? `${unavailableProducts.length} listed product${unavailableProducts.length === 1 ? " has" : "s have"} zero stock` : "Some listings may have limited availability"}${lowStockProducts.length ? `, and ${lowStockProducts.length} more have 10 or fewer units` : ""}.`,
      severity: c.inStockPct < 85 ? "critical" : "warning",
      evidence: { inStockPct: c.inStockPct, unavailableProducts: unavailableProducts.map(x => x.sku || x.name) }
    });
  }

  if (c.cancellationPct > 5) {
    signals.push({
      key: "cancellations",
      title: "Order cancellations are above the working threshold",
      detail: `Cancellation rate is ${c.cancellationPct}% versus ${p.cancellationPct}% in the previous period. Reconcile listed stock with physical stock and check dispatch capacity and pending orders.`,
      severity: c.cancellationPct > 8 ? "critical" : "warning",
      evidence: { previousPct: p.cancellationPct, currentPct: c.cancellationPct }
    });
  }

  if (c.rating > 0 && c.rating < 4) {
    signals.push({
      key: "rating",
      title: "Recent customer experience needs attention",
      detail: `Average rating is ${c.rating.toFixed(1)}. Review low-rated orders and identify recurring product, packaging or fulfilment issues.`,
      severity: "warning",
      evidence: { rating: c.rating }
    });
  }

  if (c.returnPct > 5) {
    signals.push({
      key: "returns",
      title: "Returns are eroding retained sales",
      detail: `Return rate is ${c.returnPct}% versus ${p.returnPct}% previously. Review return reasons and check whether product descriptions match what buyers receive.`,
      severity: c.returnPct > 8 ? "critical" : "warning",
      evidence: { previousPct: p.returnPct, currentPct: c.returnPct }
    });
  }

  const actions: any[] = [];
  if (stockRiskProducts.length || (hasCurrentStockMetric && c.inStockPct < 90)) {
    const productNames = stockRiskProducts.slice(0, 3).map(x => `${x.name} (${safeNumber(x.stock)} units)`);
    actions.push({
      id: "availability",
      title: "Recover availability on high-intent SKUs",
      priority: "urgent",
      impact: "Protect orders already being lost to unavailable products",
      firstStep: productNames.length ? `Confirm replenishment date for ${productNames.join(", ")}.` : "Export low-stock SKUs and confirm physical inventory against seller-panel quantities.",
      reason: "Do not spend to drive more traffic to products that cannot be fulfilled.",
      owner: "Seller",
      timeline: "Today",
      successMetric: "Priority SKUs back in stock and inventory accuracy confirmed"
    });
  }

  if (c.cancellationPct > 5) {
    actions.push({
      id: "cancellations",
      title: "Stop avoidable cancellations",
      priority: "urgent",
      impact: "Protect order completion and account experience",
      firstStep: "Reconcile stock for open orders, review cancellation reasons, and check dispatch capacity twice daily.",
      reason: "The cancellation rate is elevated; inventory mismatch and dispatch delays should be checked before increasing demand.",
      owner: "Seller operations",
      timeline: "Next 48 hours",
      successMetric: "Cancellation rate trends toward 5% or lower"
    });
  }

  if (changes.visits !== null && changes.visits <= -8) {
    actions.push({
      id: "traffic",
      title: "Restore qualified listing traffic",
      priority: "high",
      impact: "Increase relevant product-page visits",
      firstStep: "Audit the top five SKUs for title keywords, category attributes, primary image quality and listing status.",
      reason: "Visits are down; improve discoverability on available products before increasing paid spend.",
      owner: "Seller catalogue team",
      timeline: "Within 3 days",
      successMetric: "Visits to priority in-stock SKUs recover week over week"
    });
  }

  if (changes.conversion !== null && changes.conversion <= -8) {
    actions.push({
      id: "conversion",
      title: "Remove product-page conversion friction",
      priority: "high",
      impact: "Convert more of the traffic already reaching listings",
      firstStep: "Compare like-for-like prices and verify images, specifications, pack contents, delivery promise and return information.",
      reason: "Conversion is down even after accounting for lower traffic; fix buyer objections before using blanket discounts.",
      owner: "Seller",
      timeline: "Within 3 days",
      successMetric: "Conversion rate improves from the current baseline"
    });
  }

  if (c.rating > 0 && c.rating < 4 || c.returnPct > 5) {
    actions.push({
      id: "customer-experience",
      title: "Reduce repeat customer-experience failures",
      priority: "medium",
      impact: "Protect ratings, repeat purchase and retained revenue",
      firstStep: "Read the latest 20 low-rated or returned order comments and group issues into quality, packaging, description mismatch and fulfilment.",
      reason: "Ratings and returns indicate that some orders may not be meeting buyer expectations.",
      owner: "Seller quality team",
      timeline: "Within 7 days",
      successMetric: "Top recurring issue has a corrective action and return rate starts declining"
    });
  }

  const score = Math.max(0, Math.min(100, Math.round(
    100
    - Math.max(0, -(changes.revenue ?? 0)) * 0.25
    - (hasCurrentStockMetric ? Math.max(0, 90 - c.inStockPct) * 0.5 : 0)
    - Math.max(0, c.cancellationPct - 3) * 1.8
    - Math.max(0, 4.5 - c.rating) * 10
    - Math.max(0, c.returnPct - 5) * 2
  )));

  const driverSummary = [
    changes.visits !== null && changes.visits < 0 ? `visits ${changes.visits.toFixed(1)}%` : null,
    changes.conversion !== null && changes.conversion < 0 ? `conversion ${changes.conversion.toFixed(1)}%` : null,
    changes.averageOrderValue !== null && Math.abs(changes.averageOrderValue) >= 2 ? `average order value ${changes.averageOrderValue.toFixed(1)}%` : null
  ].filter(Boolean);

  return {
    previous: p,
    current: { ...c, conversionRate: currentConversion, averageOrderValue: currentAov },
    changes: {
      revenueLabel: formatChange(changes.revenue),
      ordersLabel: formatChange(changes.orders),
      visitsLabel: formatChange(changes.visits),
      conversionLabel: formatChange(changes.conversion),
      averageOrderValueLabel: formatChange(changes.averageOrderValue),
      revenuePct: changes.revenue,
      ordersPct: changes.orders,
      visitsPct: changes.visits,
      conversionPct: changes.conversion,
      conversionPoints: currentConversion - previousConversion,
      averageOrderValuePct: changes.averageOrderValue
    },
    driverSummary: driverSummary.length ? `The measurable pressure points are ${driverSummary.join(", ")}.` : "No material negative movement was found in the available metrics.",
    signals,
    actions,
    unavailableProducts: stockRiskProducts.map(product => ({
      name: product.name,
      sku: product.sku,
      stock: safeNumber(product.stock),
      views: safeNumber(product.views),
      orders: safeNumber(product.orders),
      availability: safeNumber(product.stock) <= 0 ? "out of stock" : "low stock"
    })),
    healthScore: score,
    healthScoreNote: "A directional demo heuristic based on sales movement, availability, cancellations, ratings and returns; not an official marketplace score."
  };
}


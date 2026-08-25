(() => {
  const n = value => Number(value) || 0;
  const pct = (value, pagu) => pagu > 0 ? value / pagu * 100 : 0;

  /**
   * Single source of truth for SAKTI financial metrics.
   * Official SP2D and accrual/potential views are intentionally kept separate.
   */
  window.getFinancialMetrics = function getFinancialMetrics(row = {}) {
    const pagu = n(row.pagu);
    const sp2d = n(row.sp2d ?? row.cumulative ?? row.realization);
    const accrual = n(row.accrual ?? row.accrualOutstanding);
    const potential = n(row.potential ?? (sp2d + accrual));
    const remainingSp2d = pagu - sp2d;
    const remainingPotential = pagu - potential;

    return {
      pagu,
      sp2d,
      accrual,
      potential,
      remainingSp2d,
      remainingPotential,
      pctSp2d: pct(sp2d, pagu),
      pctAccrual: pct(accrual, pagu),
      pctPotential: pct(potential, pagu),
      pctRemainingSp2d: pct(remainingSp2d, pagu),
      pctRemainingPotential: pct(remainingPotential, pagu),
      // Compatibility aliases: generic `remaining` now always means after potential.
      remaining: remainingPotential,
      absorption: pct(sp2d, pagu),
    };
  };

  window.sumFinancialMetrics = function sumFinancialMetrics(rows = []) {
    const total = rows.reduce((sum, row) => {
      const m = window.getFinancialMetrics(row);
      sum.pagu += m.pagu;
      sum.sp2d += m.sp2d;
      sum.accrual += m.accrual;
      sum.potential += m.potential;
      return sum;
    }, { pagu: 0, sp2d: 0, accrual: 0, potential: 0 });
    return window.getFinancialMetrics(total);
  };

  window.validateFinancialMetrics = function validateFinancialMetrics(rows = []) {
    const issues = [];
    rows.forEach((row, index) => {
      const m = window.getFinancialMetrics(row);
      if (Math.abs((m.sp2d + m.accrual) - m.potential) > 0.5) issues.push({ index, type: 'potential_mismatch', row });
      if (Math.abs((m.pagu - m.potential) - m.remainingPotential) > 0.5) issues.push({ index, type: 'remaining_mismatch', row });
      if (m.sp2d < 0 || m.accrual < 0 || m.potential < 0) issues.push({ index, type: 'negative_value', row });
      if (m.potential > m.pagu + 0.5) issues.push({ index, type: 'potential_over_pagu', row });
    });
    return issues;
  };

  console.info('[Financial Metrics] single source active: SP2D and potential remaining separated');
})();

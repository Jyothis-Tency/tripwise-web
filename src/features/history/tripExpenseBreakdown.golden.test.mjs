/**
 * Golden financial cases (no vitest) — run: node src/features/history/tripExpenseBreakdown.golden.test.mjs
 * Mirrors History / tripFinancial.js rules for Total Cab Cost and Owner Profit.
 */
function isFuel(type) {
  const t = String(type ?? "")
    .toLowerCase()
    .trim();
  return t === "fuel" || t === "petrol" || t === "diesel";
}

function breakdown(trip) {
  let fuel = 0;
  let extra = 0;
  for (const e of trip.expenses ?? []) {
    const amt = Number(e.amount) || 0;
    if (isFuel(e.type) || isFuel(e.category)) fuel += amt;
    else extra += amt;
  }
  const cab = Number(trip.cabCost) || 0;
  const totalCabCost = Math.round((extra + cab) * 100) / 100;
  const agency = Number(trip.agencyCost) || 0;
  const profit = Math.round(Math.max(agency - totalCabCost, 0) * 100) / 100;
  return { fuel, extra, totalCabCost, profit };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const tollDiesel = breakdown({
  agencyCost: 5000,
  cabCost: 4500,
  expenses: [
    { type: "diesel", amount: 100 },
    { type: "toll", amount: 40 },
  ],
});
assert(tollDiesel.totalCabCost === 4540, "totalCabCost cab+toll");
assert(tollDiesel.profit === 460, "profit excludes fuel");
assert(tollDiesel.fuel === 100, "fuel");

const categoryFuel = breakdown({
  agencyCost: 5000,
  cabCost: 4500,
  expenses: [
    { category: "petrol", amount: 200 },
    { type: "parking", amount: 50 },
  ],
});
assert(categoryFuel.totalCabCost === 4550, "category fuel");
assert(categoryFuel.profit === 450, "profit with parking");

console.log("tripExpenseBreakdown golden cases: OK");

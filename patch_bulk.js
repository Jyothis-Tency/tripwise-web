const fs = require('fs');

let code = fs.readFileSync('src/features/bulk-entry/pages/BulkEntryPage.tsx', 'utf8');

// 1. Import CheckCircle
if (!code.includes('CheckCircle')) {
  code = code.replace(/CloudOff,\s*Copy,/g, 'CloudOff, Copy, CheckCircle,');
}

// 2. Add filterStatus state to main component
code = code.replace(
  /const \[bulkGroups, setBulkGroupsRaw\] = useState<DriverGroup\[\]>/g,
  `const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');\n\n  // State — bulk data (functional updater pattern for perf)\n  const [bulkGroups, setBulkGroupsRaw] = useState<DriverGroup[]>`
);

// 3. Add filter dropdown in UI Header (below agencies refresh)
code = code.replace(
  /(<button onClick=\{\(\) => loadTrips\(selectedId\)\} title="Refresh data".*?<\/button>)/,
  `$1\n            <select\n              value={filterStatus}\n              onChange={e => setFilterStatus(e.target.value as any)}\n              className="h-8 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none hover:bg-slate-50"\n            >\n              <option value="all">View All Trips</option>\n              <option value="pending">Pending Trips</option>\n              <option value="completed">Completed Trips</option>\n            </select>`
);

// 4. Pass filterStatus to tables
code = code.replace(
  /<BulkEntryTable\s+groups=\{bulkGroups\}\s+onChange=\{setBulkGroups\}/,
  `<BulkEntryTable\n              groups={bulkGroups}\n              onChange={setBulkGroups}\n              filterStatus={filterStatus}`
);
code = code.replace(
  /<NormalEntryTable\s+entries=\{normalEntries\}\s+onChange=\{setNormalEntries\}/,
  `<NormalEntryTable\n              entries={normalEntries}\n              onChange={setNormalEntries}\n              filterStatus={filterStatus}`
);

// 5. Update BulkEntryTable props
code = code.replace(
  /agencyName\?: string;\n\}\) \{/,
  `agencyName?: string;\n  filterStatus?: 'all' | 'pending' | 'completed';\n}) {\n  const isRowHidden = (isCompleted?: boolean) => {\n    if (filterStatus === 'pending') return !!isCompleted;\n    if (filterStatus === 'completed') return !isCompleted;\n    return false;\n  };`
);
code = code.replace(
  /agencyName\?: string,\n\}\) \{/,
  `agencyName?: string;\n  filterStatus?: 'all' | 'pending' | 'completed';\n}) {\n  const isRowHidden = (isCompleted?: boolean) => {\n    if (filterStatus === 'pending') return !!isCompleted;\n    if (filterStatus === 'completed') return !isCompleted;\n    return false;\n  };`
);

// Add isRowHidden to NormalEntryTable
code = code.replace(
  /agencyName\?: string;\n\}\) \{[\s\S]*?function NormalEntryTable.*?\{/,
  `$&` // wait, we can just replace NormalEntryTable signature
);
code = code.replace(
  /function NormalEntryTable\(\{ entries, onChange, onDeleteTrip, agencyName \}: \{/,
  `function NormalEntryTable({ entries, onChange, onDeleteTrip, agencyName, filterStatus = 'all' }: {\n  filterStatus?: 'all' | 'pending' | 'completed';`
);

// Helper injection for NormalEntryTable inside function start
code = code.replace(
  /(function NormalEntryTable.*?\{\s*)/,
  `$1const isRowHidden = (isCompleted?: boolean) => {\n    if (filterStatus === 'pending') return !!isCompleted;\n    if (filterStatus === 'completed') return !isCompleted;\n    return false;\n  };\n  const toggleComplete = (i: number) => {\n    onChange(prev => {\n      const next = [...prev];\n      next[i] = { ...next[i], isCompleted: !next[i].isCompleted };\n      return next;\n    });\n  };`
);

// Setup toggleComplete inside BulkEntryTable
code = code.replace(
  /const updateRow = useCallback\(\(gi: number, ri: number, field: keyof BulkTripRow, val: any\) => \{/,
  `const toggleComplete = useCallback((gi: number, ri: number) => {\n    onChange(prev => {\n      const next = [...prev];\n      const row = next[gi].rows[ri];\n      row.isCompleted = !row.isCompleted;\n      return next;\n    });\n  }, [onChange]);\n\n  const updateRow = useCallback((gi: number, ri: number, field: keyof BulkTripRow, val: any) => {`
);

// 6. Apply hidden to Group Div in BulkEntryTable if all rows are hidden (and more than 1 group)
code = code.replace(
  /<div key=\{gi\} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">/,
  `<div key={gi} className={\`rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden \${groups.length > 1 && g.rows.every(r => isRowHidden(r.isCompleted)) ? 'hidden' : ''}\`}>`
);

// 7. Apply hidden to Mobile rows in Bulk
code = code.replace(
  /<div key=\{r\.clientRowId\} className="p-4 space-y-3">/,
  `<div key={r.clientRowId} className={\`p-4 space-y-3 \${isRowHidden(r.isCompleted) ? 'hidden' : ''}\`}>`
);
// And toggle button for mobile
code = code.replace(
  /\{r\._id \? \(/,
  `<button type="button" onClick={() => toggleComplete(gi, ri)}\n                        title={r.isCompleted ? 'Mark as pending' : 'Mark as completed'}\n                        className={\`p-1 transition \${r.isCompleted ? 'text-emerald-500 hover:text-emerald-600' : 'text-slate-300 hover:text-slate-400'}\`}>\n                        <CheckCircle className="h-4 w-4" />\n                      </button>\n                      {r._id ? (`
);

// 8. Apply hidden to Desktop rows in Bulk
code = code.replace(
  /<tr key=\{r\.clientRowId\} className="border-t border-slate-50 hover:bg-slate-50\/30">/,
  `<tr key={r.clientRowId} className={\`border-t border-slate-50 hover:bg-slate-50/30 \${isRowHidden(r.isCompleted) ? 'hidden' : ''}\`}>`
);
// toggle button for desktop
code = code.replace(
  /<td className="px-2 py-1\.5">\s*\{r\._id \? \(/,
  `<td className="px-2 py-1.5 flex flex-col gap-1 items-center">\n                      <button type="button" onClick={() => toggleComplete(gi, ri)}\n                        title={r.isCompleted ? 'Mark as pending' : 'Mark as completed'}\n                        className={\`p-1 transition \${r.isCompleted ? 'text-emerald-500 hover:text-emerald-600' : 'text-slate-300 hover:text-slate-400'}\`}>\n                        <CheckCircle className="h-4 w-4" />\n                      </button>\n                      {r._id ? (`
);

// 9. Apply to NormalEntryTable <tr>
code = code.replace(
  /<tr key=\{i\} className="border-t border-slate-50 hover:bg-slate-50\/30">/,
  `<tr key={i} className={\`border-t border-slate-50 hover:bg-slate-50/30 \${isRowHidden(e.isCompleted) ? 'hidden' : ''}\`}>`
);
// Normal table toggle button
code = code.replace(
  /<td className="px-2 py-1\.5">\s*<div className="flex flex-col gap-1">/,
  `<td className="px-2 py-1.5">\n                    <div className="flex flex-col gap-1 items-center">\n                      <button type="button" onClick={() => toggleComplete(i)}\n                        title={e.isCompleted ? 'Mark as pending' : 'Mark as completed'}\n                        className={\`p-1 transition \${e.isCompleted ? 'text-emerald-500 hover:text-emerald-600' : 'text-slate-300 hover:text-slate-400'}\`}>\n                        <CheckCircle className="h-4 w-4" />\n                      </button>`
);

fs.writeFileSync('src/features/bulk-entry/pages/BulkEntryPage.tsx', code);
console.log('Patch completed');

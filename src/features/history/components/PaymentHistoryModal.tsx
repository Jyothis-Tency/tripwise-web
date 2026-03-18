import type { TripPayment } from '../api';
import { X, Calendar, FileText, CreditCard, ExternalLink } from 'lucide-react';

function fmtCurrency(v: number): string {
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string): string {
  if (!d) return '—';
  // Attempt to parse ISO to clean string
  try {
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return d.split('T')[0];
  }
}

export function PaymentHistoryModal({
  onClose,
  payments = [],
  summary,
  tripNumber
}: {
  onClose: () => void;
  payments: TripPayment[];
  summary: { totalAmount: number; totalPaid: number; remainingBalance: number; paymentStatus: string };
  tripNumber: string;
}) {

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="font-semibold text-slate-800">Payment History</h3>
            <p className="text-xs text-slate-500 mt-0.5">Trip {tripNumber}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-5 flex-1">
          {/* Summary Banner */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <div className="text-[11px] font-medium text-slate-500 mb-0.5">Total Amount</div>
              <div className="text-sm font-semibold text-slate-700">{fmtCurrency(summary?.totalAmount || 0)}</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
              <div className="text-[11px] font-medium text-emerald-600 mb-0.5">Paid Amount</div>
              <div className="text-sm font-semibold text-emerald-700">{fmtCurrency(summary?.totalPaid || 0)}</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
              <div className="text-[11px] font-medium text-amber-600 mb-0.5">Remaining</div>
              <div className="text-sm font-semibold text-amber-700">{fmtCurrency(summary?.remainingBalance || 0)}</div>
            </div>
          </div>

          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Transactions</h4>

          {payments.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
              <p className="text-sm text-slate-500">No payments recorded for this trip.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map(payment => (
                <div key={payment._id} className="bg-white border text-sm border-slate-200 rounded-xl p-3 shadow-sm hover:border-indigo-200 transition">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 text-slate-700 font-medium">
                      <CreditCard className="h-4 w-4 text-emerald-500" />
                      {fmtCurrency(payment.amount)}
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 font-medium text-slate-600">
                      {payment.paymentMethod}
                    </span>
                  </div>
                  <div className="space-y-1.5 px-6">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Calendar className="h-3.5 w-3.5" />
                      {fmtDate(payment.paymentDate || payment.createdAt)}
                    </div>
                    {payment.referenceNumber && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Ref: <span className="text-slate-700">{payment.referenceNumber}</span>
                      </div>
                    )}
                    {payment.notes && (
                      <div className="flex items-start gap-1.5 text-xs text-slate-500">
                        <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span className="italic">"{payment.notes}"</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

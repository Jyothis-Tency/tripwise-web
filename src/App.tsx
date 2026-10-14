import { Route, Routes, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminProtectedRoute } from "./components/AdminProtectedRoute";
import { LoginPage } from "./features/auth/pages/Login";
import { ForgotPasswordPage } from "./features/auth/pages/ForgotPasswordPage";
import { ProfilePage } from "./features/auth/pages/ProfilePage";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { DashboardPage } from "./features/dashboard/pages/DashboardPage";
import { VehiclesPage } from "./features/vehicles/pages/VehiclesPage";
import { PLPage } from "./features/pnl/pages/PLPage";
import { TrackingPage } from "./features/tracking/pages/TrackingPage";
import { BulkEntryPage } from "./features/bulk-entry/pages/BulkEntryPage";
import { GuestBulkEntryPage } from "./features/guest-bulk/pages/GuestBulkEntryPage";
import { HistoryPage } from "./features/history/pages/HistoryPage";
import { HistoryPayoutPage } from "./features/history/pages/HistoryPayoutPage";
// import { CashInCashOutPage } from './features/cash-in-cash-out/pages/CashInCashOutPage';
import { TransactionPage } from "./features/transactions/pages/TransactionPage";
import { TransactionHistoryPage } from "./features/transactions/pages/TransactionHistoryPage";
import DriversPage from "./features/drivers/pages/DriversPage";
import RemindersPage from "./features/reminders/pages/RemindersPage";
import ExpensesPage from "./features/expenses/pages/ExpensesPage";
import { CreateNewTripPage } from "./features/trips/pages/CreateNewTripPage";
import { TripConfirmationPage } from "./features/trip-confirmation/pages/TripConfirmationPage";
import { TripConfirmationTemplatePage } from "./features/trip-confirmation/pages/TripConfirmationTemplatePage";
import { ComingSoonPage } from "./components/ui/ComingSoonPage";
import { ReportsPage } from "./features/reports/pages/ReportsPage";
import { AdminLayout } from "./features/admin/components/AdminLayout";
import { AdminOverviewPage } from "./features/admin/pages/AdminOverviewPage";
import { AdminOwnersPage } from "./features/admin/pages/AdminOwnersPage";
import { AdminDriversPage } from "./features/admin/pages/AdminDriversPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/guest-bulk/:token" element={<GuestBulkEntryPage />} />

      <Route
        path="/admin"
        element={
          <AdminProtectedRoute>
            <AdminLayout />
          </AdminProtectedRoute>
        }
      >
        <Route index element={<AdminOverviewPage />} />
        <Route path="owners" element={<AdminOwnersPage />} />
        <Route path="drivers" element={<AdminDriversPage />} />
      </Route>

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="create-trip" element={<CreateNewTripPage />} />
        <Route path="trip-confirmation" element={<TripConfirmationPage />} />
        <Route
          path="trip-confirmation/template"
          element={<TripConfirmationTemplatePage />}
        />
        <Route path="trips" element={<Navigate to="/create-trip" replace />} />
        <Route path="bulk-entry" element={<BulkEntryPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="history/payout" element={<HistoryPayoutPage />} />
        {/* Cash In / Cash Out — temporarily hidden; use Transaction instead */}
        {/* <Route path="cash-in-cash-out" element={<CashInCashOutPage />} /> */}
        <Route
          path="cash-in-cash-out"
          element={<Navigate to="/transaction" replace />}
        />
        <Route
          path="pay-in-pay-out"
          element={<Navigate to="/transaction" replace />}
        />
        <Route path="transaction" element={<TransactionPage />} />
        <Route
          path="transaction-history"
          element={<TransactionHistoryPage />}
        />
        <Route
          path="analytics"
          element={
            <ComingSoonPage
              title="Analytics"
              description="Comprehensive fleet analytics with charts, trends, and insights."
              icon="📊"
            />
          }
        />
        <Route path="pl" element={<PLPage />} />
        <Route path="reminders" element={<RemindersPage />} />
        <Route
          path="credit-debit"
          element={
            <ComingSoonPage
              title="Credit / Debit"
              description="Track credits, debits, and outstanding balances across your fleet."
              icon="💳"
            />
          }
        />
        <Route path="tracking" element={<TrackingPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

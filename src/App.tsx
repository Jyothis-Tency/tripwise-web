import { Route, Routes, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './features/auth/pages/Login';
import { DashboardLayout } from './layouts/DashboardLayout';
import { DashboardPage } from './features/dashboard/pages/DashboardPage';
import { VehiclesPage } from './features/vehicles/pages/VehiclesPage';
import { PLPage } from './features/pnl/pages/PLPage';
import { TrackingPage } from './features/tracking/pages/TrackingPage';
import { BulkEntryPage } from './features/bulk-entry/pages/BulkEntryPage';
import { HistoryPage } from './features/history/pages/HistoryPage';
import { HistoryPayoutPage } from './features/history/pages/HistoryPayoutPage';
import DriversPage from './features/drivers/pages/DriversPage';
import RemindersPage from './features/reminders/pages/RemindersPage';
import ExpensesPage from './features/expenses/pages/ExpensesPage';
import { CreateNewTripPage } from './features/trips/pages/CreateNewTripPage';
import { ComingSoonPage } from './components/ui/ComingSoonPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="create-trip" element={<CreateNewTripPage />} />
        <Route path="trips" element={<Navigate to="/create-trip" replace />} />
        <Route path="bulk-entry" element={<BulkEntryPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="history/payout" element={<HistoryPayoutPage />} />
        <Route path="analytics" element={<ComingSoonPage title="Analytics" description="Comprehensive fleet analytics with charts, trends, and insights." icon="📊" />} />
        <Route path="pl" element={<PLPage />} />
        <Route path="reminders" element={<RemindersPage />} />
        <Route path="credit-debit" element={<ComingSoonPage title="Credit / Debit" description="Track credits, debits, and outstanding balances across your fleet." icon="💳" />} />
        <Route path="tracking" element={<TrackingPage />} />
        <Route path="admin" element={<ComingSoonPage title="Admin Panel" description="User management, roles, permissions, and system configuration." icon="⚙️" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

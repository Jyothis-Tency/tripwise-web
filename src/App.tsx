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
import DriversPage from './features/drivers/pages/DriversPage';
import RemindersPage from './features/reminders/pages/RemindersPage';
import ExpensesPage from './features/expenses/pages/ExpensesPage';

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
        <Route path="trips" element={<div>Trips (coming soon)</div>} />
        <Route path="bulk-entry" element={<BulkEntryPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="analytics" element={<div>Analytics (coming soon)</div>} />
        <Route path="pl" element={<PLPage />} />
        <Route path="reminders" element={<RemindersPage />} />
        <Route path="credit-debit" element={<div>Credit / Debit (coming soon)</div>} />
        <Route path="tracking" element={<TrackingPage />} />
        <Route path="admin" element={<div>Admin (coming soon)</div>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

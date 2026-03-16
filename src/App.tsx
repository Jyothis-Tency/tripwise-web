import { Route, Routes, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './features/auth/pages/Login';
import { DashboardLayout } from './layouts/DashboardLayout';
import { DashboardPage } from './features/dashboard/pages/DashboardPage';
import { VehiclesPage } from './features/vehicles/pages/VehiclesPage';

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
        <Route path="drivers" element={<div>Drivers (coming soon)</div>} />
        <Route path="trips" element={<div>Trips (coming soon)</div>} />
        <Route path="bulk-entry" element={<div>Bulk Entry (coming soon)</div>} />
        <Route path="expenses" element={<div>Expenses (coming soon)</div>} />
        <Route path="history" element={<div>History (coming soon)</div>} />
        <Route path="analytics" element={<div>Analytics (coming soon)</div>} />
        <Route path="pl" element={<div>P&L (coming soon)</div>} />
        <Route path="reminders" element={<div>Reminders (coming soon)</div>} />
        <Route path="credit-debit" element={<div>Credit / Debit (coming soon)</div>} />
        <Route path="tracking" element={<div>Tracking (coming soon)</div>} />
        <Route path="admin" element={<div>Admin (coming soon)</div>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

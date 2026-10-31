import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeDetails from './pages/EmployeeDetails';
import Sites from './pages/Sites';
import Attendance from './pages/Attendance';
import Leaves from './pages/Leaves';
import Payroll from './pages/Payroll';
import Reports from './pages/Reports';
import Benefits from './pages/Benefits';
import Profile from './pages/Profile';
import SiteShift from './pages/SiteShift';
import UserManagement from './pages/UserManagement';
import Recruitment from './pages/Recruitment';
import Invoices from './pages/Invoices';
import Vendors from './pages/Vendors';
import Assets from './pages/Assets';
import MobileApp from './pages/MobileApp';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />

          <Route path="profile" element={<Profile />} />
          <Route path="site-shift" element={<ProtectedRoute requiredPermission="SITES.can_view"><SiteShift /></ProtectedRoute>} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="recruitment" element={<ProtectedRoute requiredPermission="RECRUITMENT.can_view"><Recruitment /></ProtectedRoute>} />
          <Route path="invoices" element={<ProtectedRoute requiredPermission="INVOICES.can_view"><Invoices /></ProtectedRoute>} />
          <Route path="vendors" element={<ProtectedRoute requiredPermission="VENDORS.can_view"><Vendors /></ProtectedRoute>} />
          <Route path="assets" element={<ProtectedRoute requiredPermission="ASSETS.can_view"><Assets /></ProtectedRoute>} />
          <Route path="mobile" element={<ProtectedRoute><MobileApp /></ProtectedRoute>} />

          <Route
            path="sites"
            element={
              <ProtectedRoute requiredPermission="SITES.can_view">
                <Sites />
              </ProtectedRoute>
            }
          />

          <Route
            path="employees"
            element={
              <ProtectedRoute requiredPermission="EMPLOYEES.can_view">
                <Employees />
              </ProtectedRoute>
            }
          />

          <Route
            path="employees/:id"
            element={
              <ProtectedRoute requiredPermission="EMPLOYEES.can_view">
                <EmployeeDetails />
              </ProtectedRoute>
            }
          />

          <Route
            path="attendance"
            element={
              <ProtectedRoute requiredPermission="ATTENDANCE.can_view">
                <Attendance />
              </ProtectedRoute>
            }
          />

          <Route
            path="leaves"
            element={
              <ProtectedRoute requiredPermission="LEAVES.can_view">
                <Leaves />
              </ProtectedRoute>
            }
          />

          <Route
            path="payroll"
            element={
              <ProtectedRoute requiredPermission="PAYROLL.can_view">
                <Payroll />
              </ProtectedRoute>
            }
          />

          <Route
            path="benefits"
            element={
              <ProtectedRoute requiredPermission="BENEFITS.can_view">
                <Benefits />
              </ProtectedRoute>
            }
          />

          <Route
            path="reports"
            element={
              <ProtectedRoute requiredPermission="REPORTS.can_view">
                <Reports />
              </ProtectedRoute>
            }
          />

          <Route
            path="users"
            element={
              <ProtectedRoute requiredRole="SUPER_ADMIN">
                <UserManagement />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;

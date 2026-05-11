import { Navigate } from "react-router-dom";
import { getDefaultRouteForRole } from "../constants/auth";
import useAuth from "../hooks/useAuth";

function PublicRoute({ children }) {
  const { isAuthenticated, user } = useAuth();

  if (isAuthenticated && user) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  return children;
}

export default PublicRoute;

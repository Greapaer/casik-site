import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Scene } from './components/Scene';
import { Header, Footer, BottomNav } from './components/Layout';
import { ToastRoot } from './components/Toasts';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useApp } from './context/AppContext';
import { Home } from './pages/Home';
import { Poker } from './pages/Poker';
import { Balance } from './pages/Balance';
import { Profile } from './pages/Profile';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { NotFound } from './pages/NotFound';
import type { ReactNode } from 'react';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useApp();
  const loc = useLocation();
  if (!ready) return <PageLoading />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return <>{children}</>;
}

function PageLoading() {
  return (
    <div className="page container" style={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }}>
      <span className="spinner display" aria-label="Loading" />
    </div>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function App() {
  const location = useLocation();
  const { ready } = useApp();

  return (
    <>
      <Scene />
      <Header />
      <main
        id="main"
        className={location.pathname.startsWith('/poker') ? 'bg-poker' : ''}
        style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}
      >
        {!ready ? (
          <PageLoading />
        ) : (
          <ErrorBoundary>
            <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname.split('/')[1] || 'home'}>
              <Route
                path="/"
                element={
                  <Page>
                    <Home />
                  </Page>
                }
              />
              <Route
                path="/poker"
                element={
                  <Page>
                    <Poker />
                  </Page>
                }
              />
              <Route
                path="/balance"
                element={
                  <Page>
                    <RequireAuth>
                      <Balance />
                    </RequireAuth>
                  </Page>
                }
              />
              <Route
                path="/profile"
                element={
                  <Page>
                    <RequireAuth>
                      <Profile />
                    </RequireAuth>
                  </Page>
                }
              />
              <Route
                path="/login"
                element={
                  <Page>
                    <Login />
                  </Page>
                }
              />
              <Route
                path="/register"
                element={
                  <Page>
                    <Register />
                  </Page>
                }
              />
              <Route
                path="*"
                element={
                  <Page>
                    <NotFound />
                  </Page>
                }
              />
            </Routes>
          </AnimatePresence>
          </ErrorBoundary>
        )}
      </main>
      <Footer />
      <BottomNav />
      <ToastRoot />
    </>
  );
}
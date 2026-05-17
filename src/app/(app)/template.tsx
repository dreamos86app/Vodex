/**
 * Pass-through template.
 *
 * Page transitions are handled in PlatformShell with a single
 * AnimatePresence keyed by pathname. Adding a second one here caused
 * intermittent white-screen hangs in production (two `mode="wait"`
 * presences racing the React 19 scheduler). Do not re-introduce.
 */
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

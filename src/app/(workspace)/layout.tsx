/**
 * Workspace layout — fully isolated, no platform shell.
 *
 * The creation workspace is a focused orchestration environment.
 * No sidebar, no topbar, no navigation clutter.
 * The workspace chrome is self-contained inside the page.
 */
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      {children}
    </div>
  );
}

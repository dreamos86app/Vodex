"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  name: string;
  children: React.ReactNode;
};

type State = { error: Error | null };

export class AdminPanelErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[admin-panel:${this.props.name}]`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-foreground">
                {this.props.name} failed to load
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {this.state.error.message || "An unexpected error occurred in this panel."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => this.setState({ error: null })}
              >
                <RefreshCw className="mr-1.5 size-3.5" />
                Retry panel
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function SafeAdminPanel({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return <AdminPanelErrorBoundary name={name}>{children}</AdminPanelErrorBoundary>;
}

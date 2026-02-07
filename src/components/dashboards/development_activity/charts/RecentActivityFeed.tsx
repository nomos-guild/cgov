import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { ChartSkeleton } from "@/components/dashboards/shared/ChartSkeleton";
import { chartCardClassName, chartCardGameClassName } from "@/components/dashboards/shared/chartTheme";
import type { ChartProps } from "@/types/dashboard";
import type { RecentActivityItem } from "@/types/development";
import { GitCommit, GitPullRequest, GitPullRequestClosed, GitMerge, CircleDot, CircleCheck, Tag } from "lucide-react";

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  commit: GitCommit,
  pr_opened: GitPullRequest,
  pr_merged: GitMerge,
  pr_closed: GitPullRequestClosed,
  issue_opened: CircleDot,
  issue_closed: CircleCheck,
  release: Tag,
};

const EVENT_LABELS: Record<string, string> = {
  commit: "Commit",
  pr_opened: "PR",
  pr_merged: "Merged",
  pr_closed: "PR Closed",
  issue_opened: "Issue",
  issue_closed: "Issue Closed",
  release: "Release",
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function buildGitHubUrl(event: RecentActivityItem): string | null {
  if (!event.repoName || !event.eventId) return null;
  const base = `https://github.com/${event.repoName}`;
  switch (event.eventType) {
    case "commit": return `${base}/commit/${event.eventId}`;
    case "pr_opened": case "pr_merged": case "pr_closed": return `${base}/pull/${event.eventId}`;
    case "issue_opened": case "issue_closed": return `${base}/issues/${event.eventId}`;
    case "release": return `${base}/releases/tag/${event.eventId}`;
    default: return null;
  }
}

export function RecentActivityFeed({ isLoading, className }: ChartProps) {
  const recent = useAppSelector((state) => state.development.recent);
  const { activeTheme } = useTheme();
  const isGame = activeTheme.id === "game";

  const events = useMemo(() => recent?.events ?? [], [recent]);

  if (isLoading) return <ChartSkeleton className={className} />;

  return (
    <div className={cn(chartCardClassName, isGame && chartCardGameClassName, className)}>
      <h3 className="text-sm font-semibold mb-3 dark:text-[#0bd1a2]">Recent Activity</h3>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {events.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
        )}
        {events.map((event) => {
          const Icon = EVENT_ICONS[event.eventType] ?? GitCommit;
          const url = buildGitHubUrl(event);
          const label = EVENT_LABELS[event.eventType] || event.eventType;

          const inner = (
            <>
              <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground dark:text-[#0bd1a2]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate dark:text-gray-200">
                  <span className="font-medium">{label}:</span>{" "}
                  {event.title || "No title"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {event.repoName && <span className="font-medium">{event.repoName}</span>}
                  {event.repoName && event.authorLogin && " · "}
                  {event.authorLogin && <span>{event.authorLogin}</span>}
                  {(event.repoName || event.authorLogin) && " · "}
                  {formatRelativeTime(event.eventDate)}
                </p>
              </div>
            </>
          );

          if (url) {
            return (
              <a
                key={event.id}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 dark:hover:bg-white/5 transition-colors"
              >
                {inner}
              </a>
            );
          }

          return (
            <div
              key={event.id}
              className="flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 dark:hover:bg-white/5 transition-colors"
            >
              {inner}
            </div>
          );
        })}
      </div>
      {(recent?.total ?? 0) > events.length && (
        <p className="text-xs text-muted-foreground text-center mt-2 pt-2 border-t dark:border-[rgba(11,209,162,0.2)]">
          Showing {events.length} of {recent?.total} events
        </p>
      )}
    </div>
  );
}

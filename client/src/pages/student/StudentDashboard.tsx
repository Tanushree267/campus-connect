import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatsCard } from "@/components/StatsCard";
import { PostCard } from "@/components/PostCard";
import { ReferralRequestCard } from "@/components/ReferralRequestCard";
import {
  deletePost,
  getConnectionCount,
  getFeedPosts,
  getMyPosts,
  getSentReferralRequests,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatName } from "@/lib/utils";
import {
  LayoutDashboard,
  Search,
  Users,
  FileText,
  Newspaper,
  PlusCircle,
  User,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type {
  Post,
  ReferralRequest,
  User as AppUser,
} from "@/lib/mock-data";

const NAV = [
  { title: "Overview", url: "/student", icon: LayoutDashboard },
  { title: "Discovery", url: "/student/discovery", icon: Search },
  { title: "Connections", url: "/student/connections", icon: Users },
  { title: "My Referrals", url: "/student/referrals", icon: FileText },
  { title: "Posts", url: "/student/posts", icon: Newspaper },
  { title: "Create Post", url: "/student/create-post", icon: PlusCircle },
  { title: "My Profile", url: "/student/profile", icon: User },
];

const normalizeId = <T extends { id?: string; _id?: string }>(
  item: T
): T & { id: string } => ({
  ...item,
  id: item.id || item._id || "",
});

type DashboardResult<T> = {
  value: T;
  error?: string;
};

const recover = <T,>(
  promise: Promise<T>,
  fallback: T,
  error: string
): Promise<DashboardResult<T>> =>
  promise.then((value) => ({ value })).catch(() => ({ value: fallback, error }));

type DashboardPost = Post & { _id?: string };
type DashboardReferral = ReferralRequest & { _id?: string };
type DashboardUser = AppUser & { _id?: string };

export default function StudentDashboard() {
  const { currentUser, loading: authLoading } = useAuth();

  const [connectionCount, setConnectionCount] = useState(0);
  const [sentReferrals, setSentReferrals] = useState<DashboardReferral[]>([]);
  const [feedPosts, setFeedPosts] = useState<DashboardPost[]>([]);
  const [myPostsCount, setMyPostsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !currentUser) return;

    let active = true;

    const fetchDashboardData = async () => {
      setLoading(true);

      const [
        connectionsResult,
        sentReferralsResult,
        myPostsResult,
        feedPostsResult,
      ] = await Promise.all([
        recover<number>(getConnectionCount(), 0, "Failed to load connections"),
        recover<DashboardReferral[]>(
          getSentReferralRequests() as Promise<DashboardReferral[]>,
          [],
          "Failed to load referral requests"
        ),
        recover<DashboardPost[]>(
          getMyPosts() as Promise<DashboardPost[]>,
          [],
          "Failed to load your posts"
        ),
        recover<DashboardPost[]>(
          getFeedPosts() as Promise<DashboardPost[]>,
          [],
          "Failed to load latest posts"
        ),
      ]);

      if (!active) return;

      setConnectionCount(connectionsResult.value);
      setSentReferrals(sentReferralsResult.value.map(normalizeId));
      setMyPostsCount(myPostsResult.value.length);
      setFeedPosts(feedPostsResult.value.map(normalizeId));

      [
        connectionsResult,
        sentReferralsResult,
        myPostsResult,
        feedPostsResult,
      ].forEach((result) => {
        if ("error" in result) toast.error(result.error);
      });

      setLoading(false);
    };

    fetchDashboardData();

    return () => {
      active = false;
    };
  }, [authLoading, currentUser]);

  if (authLoading || !currentUser) return null;

  const pendingReferralCount = sentReferrals.filter(
    (r) => r.status === "pending"
  ).length;

  const recentReferrals = sentReferrals.slice(0, 3);
  const latestPosts = feedPosts.slice(0, 3);

  // ✅ FIXED: safe id handling (prevents TS _id errors)
  const currentUserId =
    (currentUser as DashboardUser).id ||
    (currentUser as DashboardUser)._id ||
    "";

  const displayName = formatName(currentUser.name);

  const dashboardUser = {
    ...currentUser,
    id: currentUserId,
    name: displayName,
  };

  const handleDelete = async (postId: string) => {
    try {
      await deletePost(postId);
      setFeedPosts((prev) => prev.filter((p) => p.id !== postId));
      setMyPostsCount((prev) => Math.max(0, prev - 1));
      toast.success("Post deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete post"
      );
    }
  };

  return (
    <DashboardLayout
      navItems={NAV}
      groupLabel="Student"
      userName={displayName}
      userRole="Student"
      userAvatar={currentUser.avatar}
      currentUser={dashboardUser}
    >
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">
          Welcome back, {displayName.split(" ")[0]}
        </h2>
        <p className="text-sm text-muted-foreground">
          Here's your activity overview
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatsCard
          title="Connections"
          value={loading ? "..." : connectionCount}
          subtitle="Professional connections"
          icon={<Users className="h-5 w-5" />}
        />
        <StatsCard
          title="Pending Referrals"
          value={loading ? "..." : pendingReferralCount}
          subtitle="Awaiting response"
          icon={<FileText className="h-5 w-5" />}
        />
        <StatsCard
          title="Reputation"
          value={currentUser.reputationScore || 0}
          subtitle="Keep contributing!"
          icon={<span className="text-lg">★</span>}
        />
        <StatsCard
          title="Posts"
          value={loading ? "..." : myPostsCount}
          subtitle="Published posts"
          icon={<Newspaper className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold mb-3">
            Recent Referral Requests
          </h3>

          <div className="space-y-3">
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground p-4 rounded-lg bg-secondary/50">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </p>
            ) : recentReferrals.length > 0 ? (
              recentReferrals.map((r) => (
                <ReferralRequestCard
                  key={r.id}
                  request={r}
                  perspective="sender"
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground p-4 rounded-lg bg-secondary/50">
                No referral requests yet.
              </p>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3">Latest Posts</h3>

          <div className="space-y-3">
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground p-4 rounded-lg bg-secondary/50">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </p>
            ) : latestPosts.length > 0 ? (
              latestPosts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  currentUserId={currentUserId}
                  onDelete={handleDelete}
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground p-4 rounded-lg bg-secondary/50">
                No posts in your network yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
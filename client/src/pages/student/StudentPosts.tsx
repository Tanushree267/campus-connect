import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PostCard } from "@/components/PostCard";
import { deletePost, getFeedPosts } from "@/lib/api";
import {
  LayoutDashboard,
  Search,
  Users,
  FileText,
  Newspaper,
  PlusCircle,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import type { Post } from "@/lib/mock-data";

const NAV = [
  { title: "Overview", url: "/student", icon: LayoutDashboard },
  { title: "Discovery", url: "/student/discovery", icon: Search },
  { title: "Connections", url: "/student/connections", icon: Users },
  { title: "My Referrals", url: "/student/referrals", icon: FileText },
  { title: "Posts", url: "/student/posts", icon: Newspaper },
  { title: "Create Post", url: "/student/create-post", icon: PlusCircle },
  { title: "My Profile", url: "/student/profile", icon: User },
];

type UserWithId = typeof useAuth extends () => infer R
  ? R extends { currentUser: infer U }
    ? U & { _id?: string }
    : never
  : never;

export default function StudentPosts() {
  const { currentUser, loading: authLoading } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const fetchedPosts = await getFeedPosts();
        setPosts(fetchedPosts);
      } catch (error) {
        console.error("Failed to fetch posts:", error);
        toast.error("Failed to load posts");
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  const handleDelete = async (postId: string) => {
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Post deleted successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete post"
      );
    }
  };

  if (authLoading || !currentUser) {
    return null;
  }

  // ✅ FIX: safe id handling (eliminates _id TS error)
  const currentUserId =
    (currentUser as UserWithId).id ||
    (currentUser as UserWithId)._id ||
    "";

  return (
    <DashboardLayout
      navItems={NAV}
      groupLabel="Student"
      userName={currentUser.name}
      userRole="Student"
      userAvatar={currentUser.avatar}
      currentUser={currentUser}
    >
      <h2 className="text-xl font-bold text-foreground mb-1">
        Network Posts
      </h2>

      <p className="text-sm text-muted-foreground mb-6">
        Posts from you and your connected alumni
      </p>

      {loading ? (
        <div className="max-w-2xl space-y-4">
          <div className="animate-pulse">
            <div className="h-32 bg-muted rounded-lg"></div>
          </div>
        </div>
      ) : posts.length === 0 ? (
        <div className="max-w-2xl text-center py-12">
          <p className="text-muted-foreground">
            No posts yet. Create your first post!
          </p>
        </div>
      ) : (
        <div className="max-w-2xl space-y-4">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              currentUserId={currentUserId}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
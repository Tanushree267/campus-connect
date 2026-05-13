import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ReferralRequestCard } from "@/components/ReferralRequestCard";
import { analyzeReferralAts, getReceivedReferralRequests, getSentReferralRequests, updateReferralRequestStatus } from "@/lib/api";
import { LayoutDashboard, Search, Users, FileText, Newspaper, PlusCircle, User, Settings, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const NAV = [
  { title: "Overview", url: "/alumni", icon: LayoutDashboard },
  { title: "Discovery", url: "/alumni/discovery", icon: Search },
  { title: "Incoming Requests", url: "/alumni/requests", icon: FileText },
  { title: "Connections", url: "/alumni/connections", icon: Users },
  { title: "My Posts", url: "/alumni/posts", icon: Newspaper },
  { title: "Create Post", url: "/alumni/create-post", icon: PlusCircle },
  { title: "Referral Settings", url: "/alumni/settings", icon: Settings },
  { title: "My Profile", url: "/alumni/profile", icon: User },
];

export default function AlumniRequests() {
  const { currentUser, loading: authLoading } = useAuth();
  const [received, setReceived] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [atsProcessingIds, setAtsProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (authLoading || !currentUser) return;

    const fetchRequests = async () => {
      try {
        setLoading(true);
        const [receivedRequests, sentRequests] = await Promise.all([
          getReceivedReferralRequests(),
          getSentReferralRequests(),
        ]);
        setReceived(receivedRequests);
        setSent(sentRequests);
      } catch (error) {
        console.error("Failed to fetch alumni referral requests:", error);
        toast.error("Failed to load referral requests");
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [authLoading, currentUser]);

  const handleStatusUpdate = async (requestId: string, status: "accepted" | "rejected") => {
    if (!requestId) return;

    setProcessingIds(prev => new Set(prev).add(requestId));

    try {
      const updatedRequest = await updateReferralRequestStatus(requestId, status);
      setReceived(prev => prev.map(request => (request.id || request._id) === requestId ? updatedRequest : request));
      toast.success(`Referral request ${status}`);
    } catch (error) {
      console.error("Failed to update referral request:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update referral request");
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleRunAtsAnalysis = async (requestId: string) => {
    if (!requestId) return;

    setAtsProcessingIds(prev => new Set(prev).add(requestId));

    try {
      const atsResult = await analyzeReferralAts(requestId);
      setReceived(prev => prev.map(request => {
        const currentId = request.id || request._id;
        return currentId === requestId ? { ...request, ...atsResult } : request;
      }));
      toast.success("ATS analysis completed");
    } catch (error) {
      console.error("Failed to run ATS analysis:", error);
      toast.error(error instanceof Error ? error.message : "Failed to run ATS analysis");
    } finally {
      setAtsProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  if (authLoading || !currentUser) {
    return null;
  }

  return (
    <DashboardLayout navItems={NAV} groupLabel="Alumni" userName={currentUser.name} userRole="Alumni" userAvatar={currentUser.avatar} currentUser={currentUser}>
      <h2 className="text-xl font-bold text-foreground mb-1">Referral Requests</h2>
      <p className="text-sm text-muted-foreground mb-6">{received.length} received, {sent.length} sent</p>

      {loading ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading referral requests...
          </div>
        </div>
      ) : (
        <Tabs defaultValue="received">
          <TabsList>
            <TabsTrigger value="received">Received ({received.length})</TabsTrigger>
            <TabsTrigger value="sent">Sent ({sent.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="received" className="space-y-3 mt-4">
            {received.length > 0 ? (
              received.map(request => {
                const requestId = request.id || request._id;
                return (
                  <ReferralRequestCard
                    key={requestId}
                    request={request}
                    perspective="receiver"
                    onAccept={() => !processingIds.has(requestId) && handleStatusUpdate(requestId, "accepted")}
                    onReject={() => !processingIds.has(requestId) && handleStatusUpdate(requestId, "rejected")}
                    onRunAts={() => !atsProcessingIds.has(requestId) && handleRunAtsAnalysis(requestId)}
                    atsProcessing={atsProcessingIds.has(requestId)}
                  />
                );
              })
            ) : (
              <div className="rounded-lg border bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground">No received requests yet.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="sent" className="space-y-3 mt-4">
            {sent.length > 0 ? (
              sent.map(request => (
                <ReferralRequestCard key={request.id || request._id} request={request} perspective="sender" />
              ))
            ) : (
              <div className="rounded-lg border bg-card p-8 text-center">
                <p className="text-sm text-muted-foreground">No sent requests yet.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </DashboardLayout>
  );
}

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  Briefcase,
  Trophy,
  Award,
  Megaphone,
  ExternalLink,
  GraduationCap,
  ImageIcon,
  Trash2,
  MapPin,
  Clock,
  Monitor,
  Calendar,
  Tag,
  Send,
  Users,
} from "lucide-react";

import { cn, normalizeExternalUrl, renderAvatar } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

const typeConfig: Record<
  string,
  { icon: typeof Briefcase; label: string; cls: string }
> = {
  job_opening: {
    icon: Briefcase,
    label: "Job Opening",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
  },

  internship_achievement: {
    icon: Award,
    label: "Internship Achievement",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },

  internship_opening: {
    icon: GraduationCap,
    label: "Internship Opening",
    cls: "bg-teal-50 text-teal-700 border-teal-200",
  },

  hackathon_achievement: {
    icon: Trophy,
    label: "Hackathon Achievement",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
  },

  referral_opportunity: {
    icon: Megaphone,
    label: "Referral Opportunity",
    cls: "bg-purple-50 text-purple-700 border-purple-200",
  },

  event: {
    icon: Calendar,
    label: "Event",
    cls: "bg-orange-50 text-orange-700 border-orange-200",
  },
};

interface PostMetadata {
  location?: string;

  eligibleBatches?: Array<string | number>;

  applicationLink?: string;

  internshipDuration?: string;

  mode?: string;

  ppoAvailable?: boolean;

  deadline?: string;

  eventCategory?: string;

  eventDate?: string;

  eventMode?: string;

  registrationLink?: string;

  roleTitle?: string;

  duration?: string;

  stipend?: string;

  stipendStatus?: "stipend" | "no_stipend";

  certificateLink?: string;

  hackathonName?: string;

  position?: string;

  teamSize?: number;

  projectTitle?: string;
}

interface Post {
  id: string;

  authorId: string | { id?: string; _id?: string };

  authorName?: string;

  authorAvatar?: string;

  title: string;

  description: string;

  type:
    | "job_opening"
    | "internship_opening"
    | "internship_achievement"
    | "hackathon_achievement"
    | "referral_opportunity"
    | "event";

  company: string;

  domain: string;

  createdAt: string;

  expiresAt?: string | null;

  batch?: number;

  jobLink?: string;

  imageUrl?: string;

  flagged?: boolean;

  metadata?: PostMetadata;
}

interface PostCardProps {
  post: Post;

  className?: string;

  onDelete?: (postId: string) => void;

  onFlag?: (postId: string) => void;

  showAdminActions?: boolean;

  currentUserId?: string;

  canDelete?: boolean;
}

const formatMode = (mode: string) =>
  mode
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");

const stipendStatusLabels: Record<
  NonNullable<PostMetadata["stipendStatus"]>,
  string
> = {
  stipend: "Stipend",
  no_stipend: "No Stipend",
};

const getEntityId = (
  entity: string | { id?: string; _id?: string } | undefined
) => {
  if (!entity) return "";

  return typeof entity === "string"
    ? entity
    : entity._id || entity.id || "";
};

export function PostCard({
  post,
  className,
  onDelete,
  onFlag,
  showAdminActions,
  currentUserId,
  canDelete,
}: PostCardProps) {
  const author = {
    name: post.authorName || "Unknown User",
    avatar: post.authorAvatar || "",
    company: post.company,
  };

  const config = typeConfig[post.type] || typeConfig.job_opening;

  const Icon = config.icon;

  const [imgError, setImgError] = useState(false);

  const isOwner = Boolean(
    currentUserId && getEntityId(post.authorId) === currentUserId
  );

  const showDeleteAction = Boolean(
    onDelete && !showAdminActions && (canDelete || isOwner)
  );

  return (
    <Card
      className={cn(
        "transition-shadow hover:shadow-md",
        post.flagged && "border-destructive/50",
        className
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {author &&
              renderAvatar(author.avatar, author.name, "h-9 w-9")}

            <div>
              <span className="text-sm font-medium text-foreground">
                {author?.name}
              </span>

              <p className="text-xs text-muted-foreground">
                {author?.company && `${author.company} · `}
                {new Date(post.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {post.flagged && (
              <Badge variant="destructive" className="text-xs">
                Flagged
              </Badge>
            )}

            <Badge
              variant="outline"
              className={cn("shrink-0 gap-1 text-xs", config.cls)}
            >
              <Icon className="h-3 w-3" />
              {config.label}
            </Badge>

            {post.expiresAt && (
              <Badge
                variant="outline"
                className="shrink-0 gap-1 text-xs text-muted-foreground"
              >
                <Calendar className="h-3 w-3" />
                Expires on{" "}
                {new Date(post.expiresAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </Badge>
            )}

            {post.type !== "job_opening" &&
              post.metadata?.ppoAvailable && (
                <Badge
                  variant="outline"
                  className="shrink-0 text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
                >
                  PPO Available
                </Badge>
              )}

            {showDeleteAction && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 border-destructive/30 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete post"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </AlertDialogTrigger>

                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete this post?
                    </AlertDialogTitle>

                    <AlertDialogDescription>
                      This action cannot be undone. This post will be
                      permanently removed from your profile and the feed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>

                    <AlertDialogAction
                      onClick={() => onDelete?.(post.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <h3 className="mt-3 font-semibold text-foreground leading-snug">
          {post.title}
        </h3>

        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          {post.description}
        </p>

        {post.imageUrl && !imgError && (
          <div className="mt-3 overflow-hidden rounded-lg border bg-muted">
            <img
              src={post.imageUrl}
              alt={`Supporting image for ${post.title}`}
              className="w-full max-h-64 object-cover"
              onError={() => setImgError(true)}
            />
          </div>
        )}

        {/* Metadata rendering */}
        <div className="mt-3 flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          <span className="rounded bg-secondary px-2 py-0.5">
            {post.domain}
          </span>

          <span className="rounded bg-secondary px-2 py-0.5">
            {post.company}
          </span>

          {post.metadata ? (
            <>
              {/* Job Opening */}
              {post.type === "job_opening" && (
                <>
                  {post.metadata.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {post.metadata.location}
                    </span>
                  )}

                  {post.metadata.eligibleBatches?.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" />
                      Eligible:{" "}
                      {post.metadata.eligibleBatches.join(", ")}
                    </span>
                  )}
                </>
              )}

              {/* Internship Opening */}
              {post.type === "internship_opening" && (
                <>
                  {post.metadata.internshipDuration && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {post.metadata.internshipDuration}
                    </span>
                  )}

                  {post.metadata.mode && (
                    <span className="inline-flex items-center gap-1">
                      <Monitor className="h-3 w-3" />
                      {formatMode(post.metadata.mode)}
                    </span>
                  )}

                  {post.metadata.eligibleBatches?.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <GraduationCap className="h-3 w-3" />
                      Eligible:{" "}
                      {post.metadata.eligibleBatches.join(", ")}
                    </span>
                  )}
                </>
              )}

              {/* Referral Opportunity */}
              {post.type === "referral_opportunity" && (
                <>
                  {post.metadata.roleTitle && (
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      Role: {post.metadata.roleTitle}
                    </span>
                  )}

                  {post.metadata.deadline && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Deadline:{" "}
                      {new Date(
                        post.metadata.deadline
                      ).toLocaleDateString("en-IN")}
                    </span>
                  )}
                </>
              )}

              {/* Event */}
              {post.type === "event" && (
                <>
                  {post.metadata.eventCategory && (
                    <span className="inline-flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {post.metadata.eventCategory}
                    </span>
                  )}

                  {post.metadata.eventDate && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(
                        post.metadata.eventDate
                      ).toLocaleDateString("en-IN")}
                    </span>
                  )}

                  {post.metadata.eventMode && (
                    <span className="inline-flex items-center gap-1">
                      <Monitor className="h-3 w-3" />
                      Mode:{" "}
                      {formatMode(post.metadata.eventMode)}
                    </span>
                  )}
                </>
              )}

              {/* Internship Achievement */}
              {post.type === "internship_achievement" && (
                <>
                  {post.metadata.roleTitle && (
                    <span className="inline-flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {post.metadata.roleTitle}
                    </span>
                  )}

                  {post.metadata.duration && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {post.metadata.duration}
                    </span>
                  )}

                  {post.metadata.stipend && (
                    <span className="inline-flex items-center gap-1">
                      <Award className="h-3 w-3" />
                      {post.metadata.stipend}
                    </span>
                  )}

                  {post.metadata.stipendStatus && (
                    <span className="inline-flex items-center gap-1">
                      <Award className="h-3 w-3" />
                      {
                        stipendStatusLabels[
                          post.metadata.stipendStatus
                        ]
                      }
                    </span>
                  )}

                  {post.metadata.certificateLink && (
                    <a
                      href={normalizeExternalUrl(
                        post.metadata.certificateLink
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 transition-colors hover:bg-emerald-100 hover:text-emerald-800"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Certificate
                    </a>
                  )}
                </>
              )}

              {/* Hackathon Achievement */}
              {post.type === "hackathon_achievement" && (
                <>
                  {post.metadata.hackathonName && (
                    <span className="inline-flex items-center gap-1">
                      <Trophy className="h-3 w-3" />
                      {post.metadata.hackathonName}
                    </span>
                  )}

                  {post.metadata.position && (
                    <span className="inline-flex items-center gap-1">
                      <Award className="h-3 w-3" />
                      {post.metadata.position}
                    </span>
                  )}

                  {post.metadata.teamSize && (
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Team Size: {post.metadata.teamSize}
                    </span>
                  )}

                  {post.metadata.projectTitle && (
                    <span className="inline-flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {post.metadata.projectTitle}
                    </span>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {/* Backward compatibility */}
              {post.batch !== undefined && (
                <span className="rounded bg-secondary px-2 py-0.5">
                  Batch {post.batch}
                </span>
              )}

              {post.jobLink && (
                <a
                  href={normalizeExternalUrl(post.jobLink)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline ml-auto"
                >
                  Apply
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </>
          )}
        </div>

        {/* Type-specific action buttons */}
        {post.metadata && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {post.type === "job_opening" &&
              post.metadata.applicationLink && (
                <a
                  href={normalizeExternalUrl(
                    post.metadata.applicationLink
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Apply Now
                </a>
              )}

            {post.type === "internship_opening" &&
              post.metadata.applicationLink && (
                <a
                  href={normalizeExternalUrl(
                    post.metadata.applicationLink
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-teal-100 text-teal-700 hover:bg-teal-200 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Apply Internship
                </a>
              )}

            {post.type === "referral_opportunity" && (
              <button
                onClick={() => {
                  const basePath =
                    window.location.pathname.startsWith("/alumni")
                      ? "/alumni"
                      : "/student";

                  window.location.href = `${basePath}/create-referral-request/${post.id}`;
                }}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
              >
                <Send className="h-3 w-3" />
                Send Request
              </button>
            )}

            {post.type === "event" &&
              post.metadata.registrationLink && (
                <a
                  href={normalizeExternalUrl(
                    post.metadata.registrationLink
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Register
                </a>
              )}
          </div>
        )}

        {/* Admin actions */}
        {showAdminActions && (
          <div className="mt-3 flex gap-2 border-t pt-3">
            <button
              onClick={() => onFlag?.(post.id)}
              className="text-xs px-3 py-1.5 rounded-md border border-input bg-background hover:bg-accent text-foreground"
            >
              {post.flagged ? "Unflag" : "Flag Post"}
            </button>

            <button
              onClick={() => onDelete?.(post.id)}
              className="text-xs px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Post
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  LayoutDashboard,
  Search,
  Users,
  FileText,
  Newspaper,
  PlusCircle,
  User,
  Upload,
  Calendar,
  Loader2,
  Settings,
  Briefcase,
} from "lucide-react";

import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";

import {
  getPostById,
  createReferralRequest,
  uploadReferralResume,
} from "@/lib/api";

/* =========================================
   STUDENT NAVIGATION
========================================= */

const STUDENT_NAV = [
  {
    title: "Overview",
    url: "/student",
    icon: LayoutDashboard,
  },

  {
    title: "Discovery",
    url: "/student/discovery",
    icon: Search,
  },

  {
    title: "Connections",
    url: "/student/connections",
    icon: Users,
  },

  {
    title: "My Referrals",
    url: "/student/referrals",
    icon: FileText,
  },

  {
    title: "Posts",
    url: "/student/posts",
    icon: Newspaper,
  },

  {
    title: "Create Post",
    url: "/student/create-post",
    icon: PlusCircle,
  },

  {
    title: "My Profile",
    url: "/student/profile",
    icon: User,
  },
];

/* =========================================
   ALUMNI NAVIGATION
========================================= */

const ALUMNI_NAV = [
  {
    title: "Overview",
    url: "/alumni",
    icon: LayoutDashboard,
  },

  {
    title: "Discovery",
    url: "/alumni/discovery",
    icon: Search,
  },

  {
    title: "Incoming Requests",
    url: "/alumni/requests",
    icon: FileText,
  },

  {
    title: "Connections",
    url: "/alumni/connections",
    icon: Users,
  },

  {
    title: "My Posts",
    url: "/alumni/posts",
    icon: Newspaper,
  },

  {
    title: "Create Post",
    url: "/alumni/create-post",
    icon: PlusCircle,
  },

  {
    title: "Referral Settings",
    url: "/alumni/settings",
    icon: Settings,
  },

  {
    title: "My Profile",
    url: "/alumni/profile",
    icon: User,
  },
];

/* =========================================
   COMPONENT
========================================= */

export default function CreateReferralRequest() {
  const navigate = useNavigate();

  const { postId } =
    useParams<{ postId: string }>();

  /* =========================
     FORM STATE
  ========================= */

  const [motivation, setMotivation] =
    useState("");

  const [linkedinUrl, setLinkedinUrl] =
    useState("");

  const [resumeFile, setResumeFile] =
    useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  /* =========================
     AUTH STATE
  ========================= */

  const {
    currentUser,
    loading: authLoading,
  } = useAuth();

  /* =========================
     POST FETCHING STATE
  ========================= */

  const [post, setPost] =
    useState<any>(null);

  const [postLoading, setPostLoading] =
    useState(true);

  const [postError, setPostError] =
    useState<string | null>(null);

  /* =========================
     USER ROLE
  ========================= */

  const isAlumni =
    currentUser?.role === "alumni";

  const navItems = isAlumni
    ? ALUMNI_NAV
    : STUDENT_NAV;

  const roleLabel = isAlumni
    ? "Alumni"
    : "Student";

  const referralsPath = isAlumni
    ? "/alumni/requests"
    : "/student/referrals";

  const discoveryPath = isAlumni
    ? "/alumni/discovery"
    : "/student/discovery";

  /* =========================================
     FETCH POST DATA
  ========================================= */

  useEffect(() => {
    if (!postId) {
      setPostError("Invalid post ID");
      setPostLoading(false);
      return;
    }

    const fetchPost = async () => {
      try {
        setPostLoading(true);
        setPostError(null);

        const fetchedPost =
          await getPostById(postId);

        setPost(fetchedPost);
      } catch (error) {
        console.error(
          "Failed to fetch post:",
          error
        );

        setPostError(
          "Failed to load referral post"
        );
      } finally {
        setPostLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  /* =========================================
     VALIDATE POST TYPE
  ========================================= */

  useEffect(() => {
    if (!postLoading && post) {
      if (
        post.type !==
        "referral_opportunity"
      ) {
        setPostError(
          "Invalid referral request"
        );

        return;
      }
    }
  }, [postLoading, post]);

  /* =========================================
     AUTH REDIRECT
  ========================================= */

  useEffect(() => {
    if (
      !authLoading &&
      !currentUser
    ) {
      navigate("/login");
    }
  }, [
    authLoading,
    currentUser,
    navigate,
  ]);

  /* =========================================
     ERROR REDIRECT
  ========================================= */

  useEffect(() => {
    if (!postLoading && postError) {
      toast.error(postError);

      navigate(discoveryPath);
    }
  }, [
    postLoading,
    postError,
    navigate,
    discoveryPath,
  ]);

  /* =========================================
     HANDLE FORM SUBMISSION
  ========================================= */

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    /* =========================
       FILE VALIDATION
    ========================= */

    if (!resumeFile) {
      toast.error(
        "Please upload your resume"
      );

      return;
    }

    if (
      resumeFile.size >
      5 * 1024 * 1024
    ) {
      toast.error(
        "Resume file size must be less than 5MB"
      );

      return;
    }

    if (
      !resumeFile.name.endsWith(
        ".pdf"
      )
    ) {
      toast.error(
        "Resume must be a PDF file"
      );

      return;
    }

    if (!currentUser) {
      toast.error(
        "Please sign in to submit referral requests"
      );

      return;
    }

    setIsSubmitting(true);

    try {
      /* =========================
         UPLOAD RESUME
      ========================= */

      const resumeUrl =
        await uploadReferralResume(
          resumeFile
        );

      /* =========================
         REQUEST PAYLOAD
      ========================= */

      const payload = {
        referralPostId: postId!,
        motivation: motivation.trim(),
        resumeUrl,

        ...(linkedinUrl.trim()
          ? {
              linkedinUrl:
                linkedinUrl.trim(),
            }
          : {}),
      };

      /* =========================
         CREATE REQUEST
      ========================= */

      await createReferralRequest(
        payload
      );

      toast.success(
        "Referral request submitted successfully!"
      );

      navigate(referralsPath);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to submit referral request"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /* =========================================
     FILE CHANGE HANDLER
  ========================================= */

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (file) {
      setResumeFile(file);
    }
  };

  /* =========================================
     LOADING STATES
  ========================================= */

  if (authLoading || !currentUser) {
    return null;
  }

  if (postLoading) {
    return (
      <DashboardLayout
        navItems={navItems}
        groupLabel={roleLabel}
        userName={currentUser.name}
        userRole={roleLabel}
        userAvatar={currentUser.avatar}
        currentUser={currentUser}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin" />

            <p className="text-muted-foreground">
              Loading referral post...
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  /* =========================================
     ERROR STATE
  ========================================= */

  if (postError || !post) {
    return null;
  }

  /* =========================================
     EXTRA POST DATA
  ========================================= */

  const deadline =
    post?.metadata?.deadline
      ? new Date(
          post.metadata.deadline
        )
      : null;

  const roleTitle =
    post?.metadata?.roleTitle ||
    post.title;

  /* =========================================
     UI
  ========================================= */

  return (
    <DashboardLayout
      navItems={navItems}
      groupLabel={roleLabel}
      userName={currentUser.name}
      userRole={roleLabel}
      userAvatar={currentUser.avatar}
      currentUser={currentUser}
    >
      <div className="max-w-2xl mx-auto">
        <h2 className="text-xl font-bold text-foreground mb-1">
          New Referral Request
        </h2>

        <p className="text-sm text-muted-foreground mb-6">
          Submit a structured referral
          request to an alumni
        </p>

        <div className="space-y-6">
          {/* =========================================
              ALUMNI INFO CARD
          ========================================= */}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Alumni Information
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-semibold text-primary">
                  {post.authorAvatar ||
                    post.authorName
                      .charAt(0)
                      .toUpperCase()}
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">
                    {post.authorName}
                  </h3>

                  <p className="text-sm text-muted-foreground">
                    {post.company} ·{" "}
                    {post.domain}
                  </p>

                  {/* =========================
                      ROLE TITLE
                  ========================= */}

                  {roleTitle && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />

                      Role: {roleTitle}
                    </p>
                  )}

                  {/* =========================
                      DEADLINE
                  ========================= */}

                  {deadline && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />

                      Deadline:{" "}
                      {deadline.toLocaleDateString(
                        "en-IN"
                      )}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* =========================================
              REQUEST FORM
          ========================================= */}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Request Details
              </CardTitle>

              <CardDescription>
                All fields are required
                except motivation and
                LinkedIn URL
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                {/* =========================
                    COMPANY
                ========================= */}

                <div className="space-y-2">
                  <Label>
                    Company
                  </Label>

                  <Input
                    value={post.company}
                    readOnly
                    className="bg-secondary/50"
                  />
                </div>

                {/* =========================
                    ROLE
                ========================= */}

                <div className="space-y-2">
                  <Label>Role</Label>

                  <Input
                    value={post.title}
                    readOnly
                    className="bg-secondary/50"
                  />
                </div>

                {/* =========================
                    RESUME UPLOAD
                ========================= */}

                <div className="space-y-2">
                  <Label>
                    Upload Resume (PDF
                    only, max 5MB)
                  </Label>

                  <div className="relative">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={
                        handleFileChange
                      }
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />

                    <div className="rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary/50 transition-colors">
                      <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />

                      <p className="text-sm text-muted-foreground">
                        {resumeFile
                          ? resumeFile.name
                          : "Click to upload PDF resume"}
                      </p>

                      <p className="text-xs text-muted-foreground mt-1">
                        PDF only, max
                        5MB
                      </p>
                    </div>
                  </div>
                </div>

                {/* =========================
                    MOTIVATION
                ========================= */}

                <div className="space-y-2">
                  <Label htmlFor="motivation">
                    Why are you
                    interested in this
                    role? (Optional)
                  </Label>

                  <Textarea
                    id="motivation"
                    placeholder="Tell the alumni why you're interested in this role and what makes you a good fit..."
                    value={motivation}
                    onChange={(e) =>
                      setMotivation(
                        e.target.value
                      )
                    }
                    maxLength={250}
                    rows={4}
                  />

                  <p className="text-xs text-muted-foreground text-right">
                    {
                      motivation.length
                    }
                    /250 characters
                  </p>
                </div>

                {/* =========================
                    LINKEDIN
                ========================= */}

                <div className="space-y-2">
                  <Label htmlFor="linkedin">
                    LinkedIn Profile URL
                    (Optional)
                  </Label>

                  <Input
                    id="linkedin"
                    type="url"
                    placeholder="https://linkedin.com/in/your-profile"
                    value={linkedinUrl}
                    onChange={(e) =>
                      setLinkedinUrl(
                        e.target.value
                      )
                    }
                  />
                </div>

                {/* =========================
                    ACTION BUTTONS
                ========================= */}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      navigate(
                        referralsPath
                      )
                    }
                    disabled={
                      isSubmitting
                    }
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={
                      isSubmitting
                    }
                  >
                    {isSubmitting
                      ? "Submitting..."
                      : "Submit Request"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
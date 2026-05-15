import { useState, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPost } from "@/lib/api";
import {
  LayoutDashboard,
  Search,
  Users,
  FileText,
  Newspaper,
  PlusCircle,
  User,
  Upload,
  X,
  ImageIcon,
  AlertCircle,
  Settings,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const STUDENT_NAV = [
  { title: "Overview", url: "/student", icon: LayoutDashboard },
  { title: "Discovery", url: "/student/discovery", icon: Search },
  { title: "Connections", url: "/student/connections", icon: Users },
  { title: "My Referrals", url: "/student/referrals", icon: FileText },
  { title: "Posts", url: "/student/posts", icon: Newspaper },
  { title: "Create Post", url: "/student/create-post", icon: PlusCircle },
  { title: "My Profile", url: "/student/profile", icon: User },
];

const ALUMNI_NAV = [
  { title: "Overview", url: "/alumni", icon: LayoutDashboard },
  { title: "Discovery", url: "/alumni/discovery", icon: Search },
  { title: "Incoming Requests", url: "/alumni/requests", icon: FileText },
  { title: "Connections", url: "/alumni/connections", icon: Users },
  { title: "My Posts", url: "/alumni/posts", icon: Newspaper },
  { title: "Create Post", url: "/alumni/create-post", icon: PlusCircle },
  { title: "Referral Settings", url: "/alumni/settings", icon: Settings },
  { title: "My Profile", url: "/alumni/profile", icon: User },
];

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_FORMATS = ["image/jpeg", "image/jpg", "image/png"];

const STUDENT_POST_TYPES = [
  { value: "internship_achievement", label: "Internship Achievement" },
  { value: "hackathon_achievement", label: "Hackathon Achievement" },
];

const ALUMNI_POST_TYPES = [
  { value: "job_opening", label: "Job Opening" },
  { value: "internship_opening", label: "Internship Opening" },
  { value: "referral_opportunity", label: "Referral Opportunity" },
  { value: "event", label: "Event" },
];

type PostMetadata = {
  roleTitle?: string;
  location?: string;
  applicationLink?: string;
  eligibleBatches?: number[];
  referralAvailable?: boolean;

  internshipDuration?: string;
  mode?: string;
  ppoAvailable?: boolean;

  referralSlots?: number;
  deadline?: string;
  requiresConnection?: boolean;

  eventCategory?: string;
  organizer?: string;
  eventMode?: string;
  registrationLink?: string;
  eventDate?: string;

  // Student achievement fields
  duration?: string;

  // merged from both files
  stipend?: string;
  stipendStatus?: "stipend" | "no_stipend";

  certificateLink?: string;

  hackathonName?: string;
  position?: string;
  teamSize?: number;
  projectTitle?: string;
};

const metadataFieldsByType: Record<string, Array<keyof PostMetadata>> = {
  job_opening: [
    "roleTitle",
    "location",
    "applicationLink",
    "eligibleBatches",
    "referralAvailable",
    "ppoAvailable",
  ],

  internship_opening: [
    "internshipDuration",
    "mode",
    "applicationLink",
    "eligibleBatches",
    "ppoAvailable",
  ],

  referral_opportunity: [
    "roleTitle",
    "ppoAvailable",
    "referralSlots",
    "deadline",
    "requiresConnection",
  ],

  event: [
    "eventCategory",
    "organizer",
    "eventMode",
    "registrationLink",
    "eventDate",
  ],

  internship_achievement: [
    "roleTitle",
    "duration",
    "stipend",
    "stipendStatus",
    "certificateLink",
  ],

  hackathon_achievement: [
    "hackathonName",
    "position",
    "teamSize",
    "projectTitle",
  ],
};

const buildMetadataPayload = (
  postType: string,
  metadata: PostMetadata
) =>
  (metadataFieldsByType[postType] || []).reduce<PostMetadata>(
    (payload, field) => {
      if (metadata[field] !== undefined) {
        payload[field] = metadata[field] as never;
      }
      return payload;
    },
    {}
  );

export default function CreatePost() {
  const navigate = useNavigate();
  const location = useLocation();

  const { currentUser, loading } = useAuth();

  const isAlumni = currentUser?.role === "alumni";

  const NAV = isAlumni ? ALUMNI_NAV : STUDENT_NAV;
  const postTypes = isAlumni
    ? ALUMNI_POST_TYPES
    : STUDENT_POST_TYPES;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [postType, setPostType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [company, setCompany] = useState("");
  const [domain, setDomain] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [imageFile, setImageFile] =
    useState<File | null>(null);

  const [imagePreview, setImagePreview] =
    useState<string | null>(null);

  const [imageError, setImageError] = useState("");

  const [metadata, setMetadata] =
    useState<PostMetadata>({});

  const handleImageSelect = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    setImageError("");

    if (!file) return;

    if (!ACCEPTED_FORMATS.includes(file.type)) {
      setImageError(
        "Only JPG, JPEG, and PNG formats are allowed."
      );
      e.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setImageError("Image must be under 2MB.");
      e.target.value = "";
      return;
    }

    setImageFile(file);

    const reader = new FileReader();

    reader.onloadend = () =>
      setImagePreview(reader.result as string);

    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePublish = async () => {
    if (!currentUser) {
      toast.error("Please sign in to publish a post.");
      return;
    }

    if (
      !postType ||
      !title.trim() ||
      !description.trim() ||
      !company.trim() ||
      !domain.trim()
    ) {
      toast.error("Please fill all required fields.");
      return;
    }

    // Job Opening Validation
    if (postType === "job_opening") {
      if (
        !metadata.roleTitle?.trim() ||
        !metadata.location?.trim() ||
        !metadata.applicationLink?.trim()
      ) {
        toast.error(
          "Please fill all required fields for job opening."
        );
        return;
      }
    }

    // Internship Opening Validation
    else if (postType === "internship_opening") {
      if (
        !metadata.internshipDuration?.trim() ||
        !metadata.mode ||
        !metadata.applicationLink?.trim()
      ) {
        toast.error(
          "Please fill all required fields for internship opening."
        );
        return;
      }
    }

    // Referral Opportunity Validation
    else if (postType === "referral_opportunity") {
      if (!metadata.roleTitle?.trim()) {
        toast.error(
          "Please fill all required fields for referral opportunity."
        );
        return;
      }
    }

    // Event Validation
    else if (postType === "event") {
      if (
        !metadata.eventCategory?.trim() ||
        !metadata.eventMode ||
        !metadata.registrationLink?.trim() ||
        !metadata.eventDate
      ) {
        toast.error(
          "Please fill all required fields for event."
        );
        return;
      }
    }

    try {
      const payload = {
        type: postType,
        title: title.trim(),
        description: description.trim(),
        company: company.trim(),
        domain: domain.trim(),

        // merged improvement from first file
        metadata: buildMetadataPayload(
          postType,
          metadata
        ),

        imageUrl: imagePreview,

        expiresAt:
          isAlumni && expiresAt
            ? expiresAt
            : null,
      };

      await createPost(payload);

      toast.success("Post published successfully!");

      navigate(
        isAlumni
          ? "/alumni/posts"
          : "/student/posts"
      );
    } catch (error) {
      console.error(
        "Failed to create post:",
        error
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create post"
      );
    }
  };

  if (loading || !currentUser) {
    return null;
  }

  return (
    <DashboardLayout
      navItems={NAV}
      groupLabel={isAlumni ? "Alumni" : "Student"}
      userName={currentUser.name}
      userRole={isAlumni ? "Alumni" : "Student"}
      userAvatar={currentUser.avatar}
      currentUser={currentUser}
    >
      <div className="max-w-2xl mx-auto">
        <h2 className="text-xl font-bold text-foreground mb-1">
          Create Post
        </h2>

        <p className="text-sm text-muted-foreground mb-6">
          {isAlumni
            ? "Share job openings or referral opportunities"
            : "Share a professional achievement"}
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Post Details
            </CardTitle>

            <CardDescription>
              Structured professional posts only — no
              entertainment content
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Post Type */}
            <div className="space-y-2">
              <Label>Post Type *</Label>

              <Select
                value={postType}
                onValueChange={(value) => {
                  setPostType(value);
                  setMetadata({});
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>

                <SelectContent>
                  {postTypes.map((t) => (
                    <SelectItem
                      key={t.value}
                      value={t.value}
                    >
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>Title *</Label>

              <Input
                placeholder="e.g. Completed Summer Internship at Zomato"
                value={title}
                onChange={(e) =>
                  setTitle(e.target.value)
                }
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description *</Label>

              <Textarea
                placeholder="Describe your achievement, what you learned, technologies used..."
                rows={4}
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value)
                }
              />
            </div>

            {/* Company + Domain */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Company / Organization *
                </Label>

                <Input
                  placeholder="e.g. Zomato"
                  value={company}
                  onChange={(e) =>
                    setCompany(e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Domain *</Label>

                <Input
                  placeholder="e.g. Frontend Development"
                  value={domain}
                  onChange={(e) =>
                    setDomain(e.target.value)
                  }
                />
              </div>
            </div>

            {/* Expiry */}
            {isAlumni && (
              <div className="space-y-2">
                <Label>Post Expiry Date</Label>

                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) =>
                    setExpiresAt(e.target.value)
                  }
                />
              </div>
            )}

            {/* JOB OPENING */}
            {postType === "job_opening" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Role Title *</Label>

                  <Input
                    placeholder="e.g. Software Engineer"
                    value={metadata.roleTitle || ""}
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        roleTitle: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Location *</Label>

                  <Input
                    placeholder="e.g. Bangalore, India"
                    value={metadata.location || ""}
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        location: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Application Link *</Label>

                  <Input
                    placeholder="https://careers.company.com/job/123"
                    value={
                      metadata.applicationLink || ""
                    }
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        applicationLink:
                          e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="jobPpoAvailable"
                    checked={
                      metadata.ppoAvailable || false
                    }
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        ppoAvailable: Boolean(
                          e.target.checked
                        ),
                      }))
                    }
                  />

                  <Label htmlFor="jobPpoAvailable">
                    PPO Available
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label>Eligible Batches</Label>

                  <p className="text-xs text-muted-foreground">
                    Select which graduation years are
                    eligible
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {[2021, 2022, 2023, 2024, 2025, 2026, 2027].map(
                      (year) => (
                        <div
                          key={year}
                          className="flex items-center space-x-2"
                        >
                          <input
                            type="checkbox"
                            id={`batch-${year}`}
                            checked={(
                              metadata.eligibleBatches ||
                              []
                            ).includes(year)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setMetadata(
                                  (prev) => ({
                                    ...prev,
                                    eligibleBatches: [
                                      ...(prev.eligibleBatches ||
                                        []),
                                      year,
                                    ].sort(),
                                  })
                                );
                              } else {
                                setMetadata(
                                  (prev) => ({
                                    ...prev,
                                    eligibleBatches:
                                      (
                                        prev.eligibleBatches ||
                                        []
                                      ).filter(
                                        (b) =>
                                          b !== year
                                      ),
                                  })
                                );
                              }
                            }}
                          />

                          <Label
                            htmlFor={`batch-${year}`}
                            className="text-sm font-normal"
                          >
                            {year}
                          </Label>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* INTERNSHIP OPENING */}
            {postType === "internship_opening" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>
                    Internship Duration *
                  </Label>

                  <Input
                    placeholder="e.g. 3 months"
                    value={
                      metadata.internshipDuration || ""
                    }
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        internshipDuration:
                          e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Mode *</Label>

                  <Select
                    value={metadata.mode || ""}
                    onValueChange={(value) =>
                      setMetadata((prev) => ({
                        ...prev,
                        mode: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="remote">
                        Remote
                      </SelectItem>

                      <SelectItem value="hybrid">
                        Hybrid
                      </SelectItem>

                      <SelectItem value="on-site">
                        On-site
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Application Link *</Label>

                  <Input
                    placeholder="https://careers.company.com/internship/123"
                    value={
                      metadata.applicationLink || ""
                    }
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        applicationLink:
                          e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="ppoAvailable"
                    checked={
                      metadata.ppoAvailable || false
                    }
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        ppoAvailable: Boolean(
                          e.target.checked
                        ),
                      }))
                    }
                  />

                  <Label htmlFor="ppoAvailable">
                    PPO Available
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label>Eligible Batches</Label>

                  <p className="text-xs text-muted-foreground">
                    Select which graduation years are
                    eligible
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {[2021, 2022, 2023, 2024, 2025, 2026, 2027].map(
                      (year) => (
                        <div
                          key={year}
                          className="flex items-center space-x-2"
                        >
                          <input
                            type="checkbox"
                            id={`internship-batch-${year}`}
                            checked={(
                              metadata.eligibleBatches ||
                              []
                            ).includes(year)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setMetadata(
                                  (prev) => ({
                                    ...prev,
                                    eligibleBatches: [
                                      ...(prev.eligibleBatches ||
                                        []),
                                      year,
                                    ].sort(),
                                  })
                                );
                              } else {
                                setMetadata(
                                  (prev) => ({
                                    ...prev,
                                    eligibleBatches:
                                      (
                                        prev.eligibleBatches ||
                                        []
                                      ).filter(
                                        (b) =>
                                          b !== year
                                      ),
                                  })
                                );
                              }
                            }}
                          />

                          <Label
                            htmlFor={`internship-batch-${year}`}
                            className="text-sm font-normal"
                          >
                            {year}
                          </Label>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* REFERRAL OPPORTUNITY */}
            {postType === "referral_opportunity" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Role Title *</Label>

                  <Input
                    placeholder="e.g. Product Manager"
                    value={metadata.roleTitle || ""}
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        roleTitle: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Referral Slots</Label>

                  <Input
                    type="number"
                    placeholder="e.g. 5"
                    value={
                      metadata.referralSlots ?? ""
                    }
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        referralSlots:
                          e.target.value
                            ? parseInt(
                                e.target.value
                              )
                            : undefined,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Deadline</Label>

                  <Input
                    type="date"
                    value={metadata.deadline || ""}
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        deadline: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="requiresConnection"
                    checked={
                      metadata.requiresConnection ||
                      false
                    }
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        requiresConnection:
                          Boolean(
                            e.target.checked
                          ),
                      }))
                    }
                  />

                  <Label htmlFor="requiresConnection">
                    Requires Connection
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="referralPpoAvailable"
                    checked={
                      metadata.ppoAvailable || false
                    }
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        ppoAvailable: Boolean(
                          e.target.checked
                        ),
                      }))
                    }
                  />

                  <Label htmlFor="referralPpoAvailable">
                    PPO Available
                  </Label>
                </div>
              </div>
            )}

            {/* EVENT */}
            {postType === "event" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Event Category *</Label>

                  <Input
                    placeholder="e.g. Workshop, Seminar"
                    value={
                      metadata.eventCategory || ""
                    }
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        eventCategory:
                          e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Organizer</Label>

                  <Input
                    placeholder="e.g. Alumni Association"
                    value={metadata.organizer || ""}
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        organizer: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Event Mode *</Label>

                  <Select
                    value={metadata.eventMode || ""}
                    onValueChange={(value) =>
                      setMetadata((prev) => ({
                        ...prev,
                        eventMode: value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="online">
                        Online
                      </SelectItem>

                      <SelectItem value="offline">
                        Offline
                      </SelectItem>

                      <SelectItem value="hybrid">
                        Hybrid
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Registration Link *</Label>

                  <Input
                    placeholder="https://eventbrite.com/event/123"
                    value={
                      metadata.registrationLink || ""
                    }
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        registrationLink:
                          e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Event Date *</Label>

                  <Input
                    type="datetime-local"
                    value={metadata.eventDate || ""}
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        eventDate: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {/* INTERNSHIP ACHIEVEMENT */}
            {postType === "internship_achievement" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Role Title</Label>

                  <Input
                    placeholder="e.g. Software Engineering Intern"
                    value={metadata.roleTitle || ""}
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        roleTitle: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Duration</Label>

                  <Input
                    placeholder="e.g. 3 months"
                    value={metadata.duration || ""}
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        duration: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* merged both stipend systems */}
                <div className="space-y-2">
                  <Label>Stipend</Label>

                  <Input
                    placeholder="e.g. ₹15,000/month"
                    value={metadata.stipend || ""}
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        stipend: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Stipend Status</Label>

                  <Select
                    value={
                      metadata.stipendStatus || ""
                    }
                    onValueChange={(value) =>
                      setMetadata((prev) => ({
                        ...prev,
                        stipendStatus:
                          value as PostMetadata["stipendStatus"],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select stipend status" />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="stipend">
                        Stipend
                      </SelectItem>

                      <SelectItem value="no_stipend">
                        No Stipend
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Certificate Link</Label>

                  <Input
                    placeholder="https://certificate.example.com"
                    value={
                      metadata.certificateLink || ""
                    }
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        certificateLink:
                          e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {/* HACKATHON ACHIEVEMENT */}
            {postType === "hackathon_achievement" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Hackathon Name</Label>

                  <Input
                    placeholder="e.g. Smart India Hackathon"
                    value={
                      metadata.hackathonName || ""
                    }
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        hackathonName:
                          e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Position</Label>

                  <Input
                    placeholder="e.g. 1st Place"
                    value={metadata.position || ""}
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        position: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Team Size</Label>

                  <Input
                    type="number"
                    placeholder="e.g. 4"
                    value={metadata.teamSize ?? ""}
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        teamSize:
                          e.target.value
                            ? parseInt(
                                e.target.value
                              )
                            : undefined,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Project Title</Label>

                  <Input
                    placeholder="e.g. AI-Powered Healthcare Assistant"
                    value={
                      metadata.projectTitle || ""
                    }
                    onChange={(e) =>
                      setMetadata((prev) => ({
                        ...prev,
                        projectTitle:
                          e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {/* IMAGE UPLOAD */}
            <div className="space-y-2">
              <Label>
                Supporting Image (optional)
              </Label>

              <p className="text-xs text-muted-foreground">
                One image only. JPG, JPEG, or PNG.
                Max 2MB.
              </p>

              {!imagePreview ? (
                <div
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-6 text-center hover:border-primary/50 hover:bg-muted/50 transition-colors"
                >
                  <Upload className="h-8 w-8 text-muted-foreground/50" />

                  <span className="text-sm text-muted-foreground">
                    Click to upload image
                  </span>

                  <span className="text-xs text-muted-foreground/70">
                    JPG, JPEG, PNG — Max 2MB
                  </span>
                </div>
              ) : (
                <div className="relative rounded-lg border overflow-hidden bg-muted">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full max-h-48 object-cover"
                  />

                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      type="button"
                      onClick={removeImage}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-2 bg-background border-t text-xs text-muted-foreground">
                    <ImageIcon className="h-3 w-3" />

                    {imageFile?.name} (
                    {(imageFile!.size / 1024).toFixed(
                      0
                    )}{" "}
                    KB)
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png"
                onChange={handleImageSelect}
                className="hidden"
              />

              {imageError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {imageError}
                </div>
              )}
            </div>

            {/* ACTIONS */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    isAlumni
                      ? "/alumni/posts"
                      : "/student/posts"
                  )
                }
              >
                Cancel
              </Button>

              <Button
                className="flex-1"
                onClick={handlePublish}
              >
                Publish Post
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
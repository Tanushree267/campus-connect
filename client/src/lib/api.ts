// API Base URL configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

/**
 * Get authorization headers with JWT token
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const normalizeReferralRequest = (request: any) => ({
  ...request,
  id: request.id || request._id,
  requesterId:
    request.requesterId?.id ||
    request.requesterId?._id ||
    request.requesterId,
  alumniId:
    request.alumniId?.id ||
    request.alumniId?._id ||
    request.alumniId,
  referralPostId:
    request.referralPostId?.id ||
    request.referralPostId?._id ||
    request.referralPostId,
});

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file"));

    reader.readAsDataURL(file);
  });

/**
 * Get current user profile
 */
export const getCurrentUser = async () => {
  const response = await fetch(`${API_BASE_URL}/api/me`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to get user data");
  }

  // Normalize API response: map collegEmail to email
  const user = {
    ...data.user,
    _id: data.user._id || data.user.id,
    id: data.user.id || data.user._id,
    email: data.user.collegEmail,
  };

  return user;
};

/**
 * Get all users for admin
 */
export const getAllUsers = async () => {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch users");
  }

  return data.users.map((user: any) => ({
    ...user,
    id: user._id,
  }));
};

/**
 * Search users with filters
 */
export const searchUsers = async (filters: {
  search?: string;
  role?: string;
  domain?: string;
  company?: string;
  passOutYear?: string;
  availableOnly?: boolean;
}) => {
  const params = new URLSearchParams();

  if (filters.search) {
    params.append("search", filters.search);
  }

  if (filters.role && filters.role !== "all") {
    params.append("role", filters.role);
  }

  if (filters.domain && filters.domain !== "all") {
    params.append("domain", filters.domain);
  }

  if (filters.company && filters.company !== "all") {
    params.append("company", filters.company);
  }

  if (filters.passOutYear && filters.passOutYear !== "all") {
    params.append("passOutYear", filters.passOutYear);
  }

  if (filters.availableOnly) {
    params.append("availableOnly", "true");
  }

  const response = await fetch(
    `${API_BASE_URL}/api/users/search?${params}`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to search users");
  }

  return data.users;
};

/**
 * Get user by ID
 */
export const getUserById = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to get user");
  }

  return data.user;
};

/**
 * Update current user profile
 */
export const updateCurrentUser = async (userData: {
  name?: string;
  bio?: string;
  skills?: string[];
  avatar?: string;
}) => {
  const response = await fetch(`${API_BASE_URL}/api/me`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(userData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to update profile");
  }

  return data.user;
};

/**
 * Send connection request
 */
export const sendConnectionRequest = async (
  toUserId: string,
  purpose: string
) => {
  const response = await fetch(`${API_BASE_URL}/api/connections`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ toUserId, purpose }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to send connection request"
    );
  }

  return data;
};

/**
 * Get accepted connections for current user
 */
export const getConnections = async () => {
  const response = await fetch(`${API_BASE_URL}/api/connections`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to get connections");
  }

  return data.connections;
};

/**
 * Get connection count for current user
 */
export const getConnectionCount = async () => {
  const response = await fetch(
    `${API_BASE_URL}/api/connections/count`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to get connection count"
    );
  }

  return data.count;
};

/**
 * Get connection status with another user
 */
export const getConnectionStatus = async (userId: string) => {
  const response = await fetch(
    `${API_BASE_URL}/api/connections/status/${userId}`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to get connection status"
    );
  }

  return data;
};

/**
 * Get unread notification count
 */
export const getUnreadNotificationCount = async () => {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/unread-count`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to get unread count"
    );
  }

  return data;
};

/**
 * Cancel connection request
 */
export const cancelConnectionRequest = async (userId: string) => {
  const response = await fetch(
    `${API_BASE_URL}/api/connections/${userId}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to cancel connection request"
    );
  }

  return data;
};

/**
 * Get notifications for current user
 */
export const getNotifications = async () => {
  const response = await fetch(`${API_BASE_URL}/api/notifications`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to get notifications"
    );
  }

  return data.notifications;
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsRead = async () => {
  const response = await fetch(
    `${API_BASE_URL}/api/notifications/read-all`,
    {
      method: "PUT",
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to mark notifications as read"
    );
  }

  return data;
};

/**
 * Accept a connection request
 */
export const acceptConnection = async (connectionId: string) => {
  const response = await fetch(
    `${API_BASE_URL}/api/connections/${connectionId}/accept`,
    {
      method: "PUT",
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to accept connection"
    );
  }

  return data;
};

/**
 * Reject a connection request
 */
export const rejectConnection = async (connectionId: string) => {
  const response = await fetch(
    `${API_BASE_URL}/api/connections/${connectionId}/reject`,
    {
      method: "PUT",
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to reject connection"
    );
  }

  return data;
};

/**
 * Create a new post
 */
export const createPost = async (postData: {
  type: string;
  title: string;
  description: string;
  company: string;
  domain: string;
  metadata: object;
  imageUrl?: string;
  expiresAt?: string | null;
}) => {
  const response = await fetch(`${API_BASE_URL}/api/posts`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(postData),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to create post");
  }

  return data.post;
};

/**
 * Delete a post owned by current user
 */
export const deletePost = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/api/posts/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to delete post");
  }

  return data;
};

/**
 * Get current user's posts
 */
export const getMyPosts = async () => {
  const response = await fetch(`${API_BASE_URL}/api/posts/me`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch posts");
  }

  return data.posts;
};

/**
 * Get network feed posts
 */
export const getFeedPosts = async () => {
  const response = await fetch(`${API_BASE_URL}/api/posts/feed`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to fetch feed posts"
    );
  }

  return data.posts;
};

/**
 * Get a single post by ID
 */
export const getPostById = async (id: string) => {
  const response = await fetch(`${API_BASE_URL}/api/posts/${id}`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch post");
  }

  return data.post;
};

/**
 * Upload a referral resume PDF and return its accessible URL
 */
export const uploadReferralResume = async (file: File) => {
  const fileData = await readFileAsDataUrl(file);

  const response = await fetch(
    `${API_BASE_URL}/api/referrals/resume`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        fileName: file.name,
        fileData,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to upload resume");
  }

  return data.resumeUrl;
};

/**
 * Create a referral request
 */
export const createReferralRequest = async (requestData: {
  referralPostId: string;
  motivation?: string;
  linkedinUrl?: string;
  resumeUrl: string;
}) => {
  const response = await fetch(`${API_BASE_URL}/api/referrals`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(requestData),
  });

  const data = await response.json();

  if (!response.ok) {
    const validationMessage = data.errors
      ?.map((error: any) => error.msg)
      .join(", ");

    throw new Error(
      validationMessage ||
        data.message ||
        "Failed to create referral request"
    );
  }

  return normalizeReferralRequest(data.data);
};

/**
 * Get sent referral requests
 */
export const getSentReferralRequests = async () => {
  const response = await fetch(
    `${API_BASE_URL}/api/referrals/sent`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to fetch sent requests"
    );
  }

  return data.data.map(normalizeReferralRequest);
};

/**
 * Get received referral requests
 */
export const getReceivedReferralRequests = async () => {
  const response = await fetch(
    `${API_BASE_URL}/api/referrals/received`,
    {
      method: "GET",
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to fetch received requests"
    );
  }

  return data.data.map(normalizeReferralRequest);
};

/**
 * Update referral request status
 */
export const updateReferralRequestStatus = async (
  requestId: string,
  status: "accepted" | "rejected"
) => {
  const response = await fetch(
    `${API_BASE_URL}/api/referrals/${requestId}/status`,
    {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to update request status"
    );
  }

  return normalizeReferralRequest(data.data);
};

/**
 * Run ATS analysis for a received referral request
 */
export const analyzeReferralAts = async (
  requestId: string
) => {
  const response = await fetch(
    `${API_BASE_URL}/api/referrals/${requestId}/analyze-ats`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to run ATS analysis"
    );
  }

  return {
    atsScore: data.atsScore,
    atsReport: {
      summary: data.summary || "",
      matchedSkills: data.matchedSkills || [],
      missingSkills: data.missingSkills || [],
      strengths: data.strengths || [],
      weaknesses: data.weaknesses || [],
      recommendation: data.recommendation || "",
    },
  };
};

/**
 * Send a message to the career chatbot
 */
export const sendChatMessage = async (
  message: string
) => {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ message }),
  });

  const data = await response.json().catch(() => ({
    success: false,
    reply: "Invalid server response",
  }));

  if (!response.ok) {
    throw new Error(
      data.reply ||
        data.message ||
        "Failed to get chatbot response"
    );
  }

  return data as {
    success: boolean;
    intent?: string;
    reply: string;
  };
};
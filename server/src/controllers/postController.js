import Post from "../models/Post.js";
import Connection from "../models/Connection.js";

/* =========================================
   ACTIVE POST FILTER
========================================= */

const activePostFilter = () => ({
  $or: [
    { expiresAt: null },
    { expiresAt: { $exists: false } },
    { expiresAt: { $gte: new Date() } },
  ],
});

/* =========================================
   NORMALIZE EXPIRY DATE
========================================= */

const normalizeExpiresAt = (expiresAt) => {
  const normalizedInput =
    typeof expiresAt === "string"
      ? expiresAt.trim()
      : expiresAt;

  if (
    normalizedInput === undefined ||
    normalizedInput === null ||
    normalizedInput === ""
  ) {
    return null;
  }

  const parsedDate =
    typeof normalizedInput === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(normalizedInput)
      ? new Date(`${normalizedInput}T23:59:59.999`)
      : new Date(normalizedInput);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("Invalid expiry date");
  }

  if (parsedDate < new Date()) {
    throw new Error("Expiry date cannot be in the past");
  }

  return parsedDate;
};

/* =========================================
   METADATA FIELD CONTROL
========================================= */

const metadataFieldsByType = {
  job_opening: [
    "roleTitle",
    "location",
    "applicationLink",
    "eligibleBatches",
    "referralAvailable",
    "salaryRange",
    "applicationMethod",
  ],

  internship_opening: [
    "internshipDuration",
    "mode",
    "applicationLink",
    "eligibleBatches",
    "ppoAvailable",
    "stipendStatus",
    "stipend",
  ],

  referral_opportunity: [
    "roleTitle",
    "ppoAvailable",
    "referralSlots",
    "slotsRemaining",
  ],

  event: [
    "eventCategory",
    "eventMode",
    "registrationLink",
    "eventDate",
    "organizer",
  ],

  internship_achievement: [
    "roleTitle",
    "duration",
    "stipend",
    "certificateLink",
  ],

  hackathon_achievement: [
    "hackathonName",
    "position",
    "teamSize",
    "projectTitle",
  ],
};

/* =========================================
   SANITIZE METADATA
========================================= */

const sanitizeMetadata = (type, metadata = {}) => {
  const allowedFields = metadataFieldsByType[type] || [];

  return allowedFields.reduce((sanitized, field) => {
    if (metadata[field] !== undefined) {
      sanitized[field] = metadata[field];
    }

    return sanitized;
  }, {});
};

/* =========================================
   TRANSFORM POST RESPONSE
========================================= */

const transformPost = (
  post,
  author = post.authorId
) => ({
  id: post._id.toString(),

  authorId: author?._id
    ? author._id.toString()
    : post.authorId.toString(),

  type: post.type,
  title: post.title,
  description: post.description,
  company: post.company,
  domain: post.domain,

  batch: author?.passOutYear,

  createdAt: post.createdAt.toISOString(),

  expiresAt: post.expiresAt
    ? post.expiresAt.toISOString()
    : null,

  imageUrl: post.imageUrl,
  flagged: post.flagged,
  metadata: post.metadata,

  authorName: author?.name || "",
  authorAvatar: author?.avatar || "",
  authorCompany: author?.company || "",
});

/* =========================================
   CREATE POST
   POST /api/posts
========================================= */

export const createPost = async (req, res) => {
  try {
    const {
      type,
      title,
      description,
      company,
      domain,
      metadata,
      imageUrl,
      expiresAt,
    } = req.body;

    const authorId = req.user._id;

    const normalizedExpiresAt =
      normalizeExpiresAt(expiresAt);

    const sanitizedMetadata =
      sanitizeMetadata(type, metadata);

    const post = new Post({
      authorId,
      type,
      title,
      description,
      company,
      domain,
      metadata: sanitizedMetadata,
      imageUrl: imageUrl || null,
      expiresAt: normalizedExpiresAt,
    });

    await post.save();

    /* =========================
       RESPONSE FORMAT
    ========================= */

    const postResponse = post.toObject();

    postResponse.id =
      postResponse._id.toString();

    delete postResponse._id;
    delete postResponse.__v;

    postResponse.authorName =
      req.user.name;

    postResponse.authorAvatar =
      req.user.avatar || "";

    postResponse.authorCompany =
      req.user.company || "";

    postResponse.expiresAt = post.expiresAt
      ? post.expiresAt.toISOString()
      : null;

    res.status(201).json({
      success: true,
      post: postResponse,
    });
  } catch (error) {
    console.error("Create post error:", error);

    res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to create post",
    });
  }
};

/* =========================================
   GET MY POSTS
   GET /api/posts/me
========================================= */

export const getMyPosts = async (
  req,
  res
) => {
  try {
    const posts = await Post.find({
      authorId: req.user._id,
      status: "published",
      ...activePostFilter(),
    })
      .sort({ createdAt: -1 })
      .lean();

    const transformedPosts = posts.map(
      (post) =>
        transformPost(post, req.user)
    );

    res.status(200).json({
      success: true,
      posts: transformedPosts,
    });
  } catch (error) {
    console.error(
      "Get my posts error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch posts",
    });
  }
};

/* =========================================
   GET FEED POSTS
   GET /api/posts/feed
========================================= */

export const getFeedPosts = async (
  req,
  res
) => {
  try {
    const currentUserId = req.user._id;

    /* =========================
       GET CONNECTIONS
    ========================= */

    const connections =
      await Connection.find({
        $or: [
          { fromUserId: currentUserId },
          { toUserId: currentUserId },
        ],
        status: "accepted",
      }).lean();

    /* =========================
       EXTRACT USER IDS
    ========================= */

    const connectedUserIds =
      connections.map((conn) =>
        conn.fromUserId.toString() ===
        currentUserId.toString()
          ? conn.toUserId
          : conn.fromUserId
      );

    /* =========================
       INCLUDE CURRENT USER
    ========================= */

    const authorIds = [
      currentUserId,
      ...connectedUserIds,
    ];

    /* =========================
       FETCH POSTS
    ========================= */

    const posts = await Post.find({
      authorId: { $in: authorIds },
      status: "published",
      ...activePostFilter(),
    })
      .sort({ createdAt: -1 })
      .populate(
        "authorId",
        "name avatar company passOutYear"
      )
      .lean();

    const transformedPosts = posts.map(
      (post) => transformPost(post)
    );

    res.status(200).json({
      success: true,
      posts: transformedPosts,
    });
  } catch (error) {
    console.error(
      "Get feed posts error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to fetch feed posts",
    });
  }
};

/* =========================================
   GET POST BY ID
   GET /api/posts/:id
========================================= */

export const getPostById = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    /* =========================
       SUPPORT BOTH id & _id
    ========================= */

    const query =
      id.match(/^[0-9a-fA-F]{24}$/)
        ? { _id: id }
        : { id };

    const post = await Post.findOne({
      ...query,
      status: "published",
      ...activePostFilter(),
    })
      .populate(
        "authorId",
        "name avatar company passOutYear"
      )
      .lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    /* =========================
       ACCESS CONTROL
    ========================= */

    const currentUserId = req.user._id;

    const isOwnPost =
      post.authorId._id.toString() ===
      currentUserId.toString();

    if (!isOwnPost) {
      const connection =
        await Connection.findOne({
          $or: [
            {
              fromUserId: currentUserId,
              toUserId: post.authorId._id,
            },

            {
              fromUserId: post.authorId._id,
              toUserId: currentUserId,
            },
          ],

          status: "accepted",
        });

      if (!connection) {
        return res.status(403).json({
          success: false,
          message:
            "You can only view posts from your connections",
        });
      }
    }

    const transformedPost =
      transformPost(post);

    res.status(200).json({
      success: true,
      post: transformedPost,
    });
  } catch (error) {
    console.error(
      "Get post by ID error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch post",
    });
  }
};

/* =========================================
   DELETE POST
   DELETE /api/posts/:id
========================================= */

export const deletePost = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    if (
      !id.match(/^[0-9a-fA-F]{24}$/)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID",
      });
    }

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (
      post.authorId.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only delete your own posts",
      });
    }

    await post.deleteOne();

    res.status(200).json({
      success: true,
      message:
        "Post deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete post error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to delete post",
    });
  }
};
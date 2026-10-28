const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf"
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new Error("Only JPEG, JPG, PNG, WEBP images and PDF files are allowed"),
      false
    );
  }
  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const uploadToCloudinary = async (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "australia_visas",
        transformation: [
          { width: 600, height: 600, crop: "limit" },
          { quality: "auto" }
        ]
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

const uploadDocumentToCloudinary = async (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "australia_visa_documents",
        resource_type: "auto"
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

const deleteFromCloudinary = async (imageUrl) => {
  try {
    const urlParts = imageUrl.split("/");
    const filename = urlParts[urlParts.length - 1];
    const folder = imageUrl.includes("australia_visa_documents")
      ? "australia_visa_documents"
      : "australia_visas";
    const publicId = `${folder}/${filename.split(".")[0]}`;
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.log("Cloudinary delete error:", error.message);
  }
};

const uploadBase64ToCloudinary = async (base64String) => {
  if (!base64String || typeof base64String !== "string") return "";
  if (!base64String.startsWith("data:image")) return base64String;
  const result = await cloudinary.uploader.upload(base64String, {
    folder: "australia_visas",
    transformation: [
      { width: 600, height: 600, crop: "limit" },
      { quality: "auto" }
    ]
  });
  return result.secure_url;
};

module.exports = {
  upload,
  uploadToCloudinary,
  uploadBase64ToCloudinary,
  uploadDocumentToCloudinary,
  deleteFromCloudinary
};


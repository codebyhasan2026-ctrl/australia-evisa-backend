const express = require("express");
const adminAuth = require("../middleware/adminAuth");
const { upload } = require("../middleware/upload");
const {
  verifyVisaStatus,
  createVisaApplication,
  getAllVisaApplications,
  getVisaApplicationById,
  updateVisaApplication,
  deleteVisaApplication,
  uploadVisaDocument,
  deleteVisaDocument,
  testEmailNotification
} = require("../controllers/visaController");

const router = express.Router();

router.post("/verify", verifyVisaStatus);
router.post("/enquiry", verifyVisaStatus);

router.post("/admin/test-email", adminAuth, testEmailNotification);
router.get("/admin/all", adminAuth, getAllVisaApplications);
router.get("/admin/:id", adminAuth, getVisaApplicationById);
router.post("/admin", adminAuth, upload.single("photo"), createVisaApplication);
router.put("/admin/:id", adminAuth, upload.single("photo"), updateVisaApplication);
router.delete("/admin/:id", adminAuth, deleteVisaApplication);

router.post("/admin/:id/document", adminAuth, upload.any(), uploadVisaDocument);
router.delete("/admin/:id/document/:docKey", adminAuth, deleteVisaDocument);

module.exports = router;

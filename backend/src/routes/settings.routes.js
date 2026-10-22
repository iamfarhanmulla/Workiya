const express = require("express");
const { authorize } = require("../middleware/authorize");
const { validate } = require("../middleware/validate");
const { ROLES } = require("../constants/roles");
const controller = require("../controllers/settings.controller");
const {
  idParamsSchema,
  companyQuerySchema,
  customFieldQuerySchema,
  activityTypeQuerySchema,
  terminologySchema,
  customFieldCreateSchema,
  customFieldUpdateSchema,
  activityTypeSchema,
} = require("../validators/settings.schemas");

const router = express.Router();

// Every signed-in user may read their company's settings; only admins may change them.
const writers = authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN);
const byId = validate(idParamsSchema, "params");
const companyQuery = validate(companyQuerySchema, "query");

router.get("/terminology", companyQuery, controller.getTerminology);
router.put("/terminology", writers, validate(terminologySchema), controller.updateTerminology);

router.get(
  "/custom-fields",
  validate(customFieldQuerySchema, "query"),
  controller.listCustomFields,
);
router.post(
  "/custom-fields",
  writers,
  validate(customFieldCreateSchema),
  controller.createCustomField,
);
router.put(
  "/custom-fields/:id",
  writers,
  byId,
  validate(customFieldUpdateSchema),
  controller.updateCustomField,
);
router.delete("/custom-fields/:id", writers, byId, companyQuery, controller.deleteCustomField);

router.get(
  "/activity-types",
  validate(activityTypeQuerySchema, "query"),
  controller.listActivityTypes,
);
router.post(
  "/activity-types",
  writers,
  validate(activityTypeSchema),
  controller.createActivityType,
);
router.put(
  "/activity-types/:id",
  writers,
  byId,
  validate(activityTypeSchema),
  controller.updateActivityType,
);
router.delete("/activity-types/:id", writers, byId, companyQuery, controller.deleteActivityType);

module.exports = router;

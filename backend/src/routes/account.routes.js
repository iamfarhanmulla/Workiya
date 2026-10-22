const express = require("express");
const { authorize } = require("../middleware/authorize");
const { validate } = require("../middleware/validate");
const { ROLES } = require("../constants/roles");
const controller = require("../controllers/account.controller");
const schemas = require("../validators/account.schemas");

const router = express.Router();

const staff = authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER);
const idParams = validate(schemas.idParamsSchema, "params");

router.get("/", validate(schemas.accountListQuerySchema, "query"), controller.list);
router.post("/", staff, validate(schemas.accountCreateSchema), controller.create);

// Static path first, so "assignments" is never read as an account id.
router.post(
  "/assignments/transfer",
  staff,
  validate(schemas.assignmentTransferSchema),
  controller.transferAssignments,
);

router.get("/:id", idParams, controller.getById);
router.put("/:id", staff, idParams, validate(schemas.accountUpdateSchema), controller.update);
router.patch(
  "/:id/status",
  staff,
  idParams,
  validate(schemas.accountStatusSchema),
  controller.setStatus,
);
router.delete("/:id", staff, idParams, controller.remove);

router.get("/:id/assignments", staff, idParams, controller.listAssignments);
router.put(
  "/:id/assignments",
  staff,
  idParams,
  validate(schemas.accountAssignmentsSchema),
  controller.replaceAssignments,
);

module.exports = router;

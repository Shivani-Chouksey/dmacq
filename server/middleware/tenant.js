
export const resolveTenant = (req, res, next) => {

  const tenantId = req.headers["x-tenant-id"];

  if (!tenantId || typeof tenantId !== "string") {
    return res.status(401).json({
      error: "TENANT_REQUIRED",
      message: "Missing or invalid x-tenant-id header",
    });
  }

  req.tenantId = tenantId;
  next();
};

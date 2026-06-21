export const buildCursorFilter = (tenantId, cursor) => {
  const filter = { tenantId };

  if (cursor) {
    filter.createdAt = {
      $lt: new Date(cursor),
    };
  }

  return filter;
};

export const getNextCursor = (data) => {
  if (!data.length) return null;

  return data[data.length - 1].createdAt;
};
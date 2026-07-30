export const config = {
  maxDuration: 10,
};

export default {
  fetch() {
    return Response.json({
      ok: true,
      service: "douban-lens-api",
    });
  },
};

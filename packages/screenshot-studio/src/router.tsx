import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

export const getRouter = async () => {
  const router = createRouter({
    routeTree,
    context: {},
    defaultPreload: "intent",
  });

  return router;
};

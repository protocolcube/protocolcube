import {
  createRouter,
  createWebHashHistory,
  type Router,
} from "vue-router";
import type { Component } from "vue";
import AuthorApplicationView from "@/features/author/views/AuthorApplicationView.vue";
import { translateLegacyHash } from "./legacy-hash";
const RoutedState: Component = { render: () => null };

export { translateLegacyHash } from "./legacy-hash";

function translateInitialLegacyHash(): void {
  const translated = translateLegacyHash(window.location.hash);
  if (translated === undefined) return;
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${window.location.search}${translated}`,
  );
}

export function createProtocolBoxRouter(): Router {
  translateInitialLegacyHash();

  return createRouter({
    history: createWebHashHistory(),
    routes: [
      {
        path: "/",
        component: AuthorApplicationView,
        children: [
          { path: "", name: "bootstrap", component: RoutedState },
          { path: "reader", name: "reader", component: RoutedState },
          { path: "author/access", name: "author-access", component: RoutedState },
          { path: "author/drafts", name: "author-drafts", component: RoutedState },
          {
            path: "author/drafts/:draftId/authoring",
            name: "author-authoring",
            component: RoutedState,
          },
          {
            path: "author/drafts/:draftId/publish",
            name: "author-publish",
            component: RoutedState,
          },
          { path: "help", name: "help", component: RoutedState },
          { path: "help/author", name: "help-author", component: RoutedState },
          {
            path: "help/author/:chapterId",
            name: "help-author-chapter",
            component: RoutedState,
          },
          { path: "help/:topic", name: "help-topic", component: RoutedState },
        ],
      },
      { path: "/:pathMatch(.*)*", redirect: { name: "bootstrap" } },
    ],
  });
}

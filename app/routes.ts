import { type RouteConfig, index, prefix, route } from "@react-router/dev/routes";

const devRoutes = import.meta.env.DEV
  ? prefix("dev", [
      route("components", "dev/components.tsx"),
      route("attract", "routes/attract.tsx"),
      route("builder", "routes/dev-builder.tsx"),
      route("scene", "routes/dev-scene.tsx"),
    ])
  : [];

export default [
  index("routes/home.tsx"),
  route("city", "routes/city.tsx"),
  route("career", "routes/career.tsx"),
  route("story", "routes/story.tsx"),
  route("story/:chapterId", "routes/story-chapter.tsx"),
  route("play", "routes/play.tsx"),
  route("crib", "routes/crib.tsx"),
  route("roster", "routes/roster.tsx"),
  route("settings", "routes/settings.tsx"),
  ...devRoutes,
] satisfies RouteConfig;

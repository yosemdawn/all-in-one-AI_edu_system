import type { NavigationGuard } from "vue-router";

// Run before loading protected menus: initial-password sessions cannot fetch them.
export function passwordChangeNavigation(
  path: string,
  mustChangePassword: boolean
) {
  if (path === "/force-change-password") return true;
  if (mustChangePassword) return "/force-change-password";
  return undefined;
}

export function createPasswordChangeGuard(
  mustChangePassword: () => boolean,
  loadAuthorizedRoute: NavigationGuard
): NavigationGuard {
  return (to, from, next) => {
    const navigation = passwordChangeNavigation(to.path, mustChangePassword());
    if (navigation === true) return next();
    if (navigation) return next(navigation);
    return loadAuthorizedRoute(to, from, next);
  };
}

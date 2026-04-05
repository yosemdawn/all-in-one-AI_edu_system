import type { UserMenu } from "@/types/role";

const TITLE_MAP: Record<string, string> = {
  "System Dashboard": "系统概览",
  Users: "用户管理",
  "User Detail": "用户详情",
  Menus: "菜单管理",
  Roles: "角色管理",
  "AI Models": "AI 模型",
  "Teaching Center": "教学中心",
  "Class Management": "班级管理",
  "Class Detail": "班级详情",
  Assignments: "作业管理",
  "Create Assignment": "创建作业",
  "Assignment Detail": "作业详情",
  "AI Rules": "AI 规则",
  Reviews: "批改中心",
  "Study Center": "学习中心",
  "My Classes": "我的班级",
  "My Assignments": "我的作业",
  "Submission Detail": "提交详情",
};

const PATH_TITLE_MAP: Record<string, string> = {
  "/admin/dashboard": "系统概览",
  "/system/users": "用户管理",
  "/system/users/:id": "用户详情",
  "/system/menus": "菜单管理",
  "/system/roles": "角色管理",
  "/system/ai_model": "AI 模型",
  "/teacher/dashboard": "教学中心",
  "/teacher/classes": "班级管理",
  "/teacher/classes-detail": "班级详情",
  "/teacher/assignments": "作业管理",
  "/teacher/assignmentsEdit": "创建作业",
  "/teacher/assignments/detail": "作业详情",
  "/teacher/ai-rules": "AI 规则",
  "/teacher/correcting": "批改中心",
  "/student/dashboard": "学习中心",
  "/student/classes": "我的班级",
  "/student/assignments": "我的作业",
  "/student/assignments/detail": "作业详情",
  "/student/submissions": "提交详情",
};

function resolveLocalizedTitle(menu: UserMenu): string {
  const pathTitle = menu.path ? PATH_TITLE_MAP[menu.path] : undefined;
  if (pathTitle) {
    return pathTitle;
  }

  const currentTitle = menu.meta?.title;
  if (currentTitle && TITLE_MAP[currentTitle]) {
    return TITLE_MAP[currentTitle];
  }

  return currentTitle || menu.name;
}

export function localizeUserMenus(menus: UserMenu[] = []): UserMenu[] {
  return menus.map((menu) => ({
    ...menu,
    meta: {
      ...(menu.meta || {}),
      title: resolveLocalizedTitle(menu),
    },
    children: menu.children ? localizeUserMenus(menu.children) : [],
  }));
}

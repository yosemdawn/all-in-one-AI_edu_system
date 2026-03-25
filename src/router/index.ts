import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

// 布局组件 - 使用布局入口文件
import LayoutIndex from "@/layouts/index.vue";

// 静态路由 - 不需要权限控制的路由
export const constantRoutes: Array<RouteRecordRaw> = [
  {
    path: "/login",
    name: "Login",
    component: () => import("../views/Login.vue"),
    meta: { requiresAuth: false },
  },

  {
    path: "/force-change-password",
    name: "ForceChangePassword",
    component: () => import("../views/ForceChangePassword.vue"),
    meta: { requiresAuth: true, skipPasswordCheck: true },
  },
  {
    path: "/redirect",
    name: "Redirect",
    component: () => import("../views/Redirect.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/404",
    name: "NotFound",
    component: () => import("../views/NotFound.vue"),
    meta: { requiresAuth: false },
  },

  // Dashboard路由 - 根据角色跳转到不同的控制台
  {
    path: "/admin",
    component: LayoutIndex,
    redirect: "/admin/dashboard",
    meta: { requiresAuth: true },
    children: [
      {
        path: "dashboard",
        name: "AdminDashboard",
        component: () => import("@/views/dashboard/AdminDashboard.vue"),
        meta: {
          title: "管理员控制台",
          icon: "Setting",
          requiresAuth: true,
          roles: ["superadmin"],
        },
      },
    ],
  },
  {
    path: "/teacher",
    component: LayoutIndex,
    redirect: "/teacher/dashboard",
    meta: { requiresAuth: true },
    children: [
      {
        path: "dashboard",
        name: "TeacherDashboard",
        component: () => import("@/views/dashboard/TeacherDashboard.vue"),
        meta: {
          title: "教师工作台",
          icon: "EditPen",
          requiresAuth: true,
          roles: ["teacher"],
        },
      },
    ],
  },
  {
    path: "/student",
    component: LayoutIndex,
    redirect: "/student/dashboard",
    meta: { requiresAuth: true },
    children: [
      {
        path: "dashboard",
        name: "StudentDashboard",
        component: () => import("@/views/dashboard/StudentDashboard.vue"),
        meta: {
          title: "学生学习台",
          icon: "Reading",
          requiresAuth: true,
          roles: ["student"],
        },
      },
    ],
  },
  // 根路径重定向 - 登录后跳转到这里，由权限控制逻辑处理角色跳转
  {
    path: "/",
    redirect: "/dashboard",
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: () => import("@/views/Redirect.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/403",
    name: "Forbidden",
    component: () => import("../views/NotFound.vue"),
    meta: { requiresAuth: false },
  },
];

// 创建路由实例 - 包含静态路由
const router = createRouter({
  history: createWebHistory(),
  routes: constantRoutes,
});

// 重置路由方法
export function resetRouter() {
  // 移除所有动态路由（保留常量路由）
  router.getRoutes().forEach((route) => {
    if (
      route.name &&
      [
        "Login",
        "ForceChangePassword",
        "NotFound",
        "Redirect",
        "Dashboard",
        "AdminDashboard",
        "TeacherDashboard",
        "StudentDashboard",
      ].indexOf(route.name.toString()) === -1
    ) {
      router.removeRoute(route.name);
    }
  });
}

export default router;

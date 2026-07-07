<template>
  <!-- 调试信息 -->
  <div v-if="!menu.hidden" style="display: contents">
    <!-- 有子菜单的情况 - 渲染为el-sub-menu -->
    <el-sub-menu
      v-if="hasChildren && menu.type === 'menu'"
      :index="menu.path || `menu-${menu._id}`"
    >
      <template #title>
        <el-icon>
          <component :is="iconComponent" />
        </el-icon>
        <span>{{ menu.meta?.title || menu.name }}</span>
      </template>

      <!-- 递归渲染子菜单 -->
      <top-nav-item
        v-for="child in menu.children"
        :key="child._id"
        :menu="child"
        @menu-click="handleMenuClick"
      />
    </el-sub-menu>

    <!-- 没有子菜单的情况 - 渲染为el-menu-item -->
    <el-menu-item
      v-else-if="menu.type !== 'button'"
      :index="menu.path || `menu-${menu._id}`"
      @click="handleMenuClick(menu.path)"
      class="flex items-center"
    >
      <el-icon class="mr-1">
        <component :is="iconComponent" />
      </el-icon>
      <span>{{ menu.meta?.title || menu.name }}</span>
    </el-menu-item>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";
import * as ElementPlusIcons from "@element-plus/icons-vue";

export default defineComponent({
  name: "TopNavItem",
  props: {
    menu: {
      type: Object,
      required: true,
    },
  },
  emits: ["menu-click"],
  setup(props, { emit }) {
    const hasChildren = computed(() => {
      return props.menu.children && props.menu.children.length > 0;
    });

    const iconComponent = computed(() => {
      const icon = props.menu.icon;

      if (!icon) return ElementPlusIcons.Menu;

      const iconName = icon.charAt(0).toUpperCase() + icon.slice(1);
      return ElementPlusIcons[iconName] || ElementPlusIcons.Menu;
    });

    const handleMenuClick = (path) => {
      emit("menu-click", path);
    };

    return {
      hasChildren,
      iconComponent,
      handleMenuClick,
    };
  },
});
</script>

<style scoped>
/* 顶部菜单项样式调整 */
:deep(.el-menu-item) {
  border-bottom: none !important;
}

:deep(.el-sub-menu__title) {
  border-bottom: none !important;
}
</style>

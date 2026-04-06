<template>
  <div
    :class="[
      'student-classes-page h-full flex',
      { 'student-classes-page--mobile': isMobile },
    ]"
  >
    <ClassList ref="classListRef" :mobile="isMobile" />
    <AssignmentList :mobile="isMobile" />

    <JoinClassDialog
      v-model="showJoinDialog"
      :mandatory="requiresInviteCode"
      @success="handleJoinSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, provide, ref, watch } from "vue";
import { useStore } from "vuex";
import JoinClassDialog from "../../../components/JoinClassDialog.vue";
import AssignmentList from "./components/AssignmentList.vue";
import ClassList from "./components/ClassList.vue";

const store = useStore();

const selectedClass = ref(null);
const selectedClassId = ref<string | null>(null);
const showJoinDialog = ref(false);
const classListRef = ref<{ refresh?: () => void } | null>(null);

const userInfo = computed(() => store.getters["user/getUserInfo"]);
const isMobile = computed(() => store.getters["app/isMobile"]);
const requiresInviteCode = computed(
  () => userInfo.value?.role === "student" && !userInfo.value?.classId
);

const setSelectedClass = (classItem: any) => {
  selectedClass.value = classItem;
  selectedClassId.value = classItem ? classItem._id : null;
};

const refreshClassList = () => {
  classListRef.value?.refresh?.();
};

const handleJoinSuccess = async () => {
  await store.dispatch("user/getUserInfo");
  refreshClassList();
  showJoinDialog.value = false;
};

watch(
  requiresInviteCode,
  (value) => {
    showJoinDialog.value = value;
  },
  { immediate: true }
);

provide("selectedClass", selectedClass);
provide("selectedClassId", selectedClassId);
provide("setSelectedClass", setSelectedClass);
provide("showJoinDialog", showJoinDialog);
provide("refreshClassList", refreshClassList);
</script>

<style scoped>
.student-classes-page {
  min-height: 100%;
}

@media (max-width: 768px) {
  .student-classes-page {
    flex-direction: column;
    gap: 12px;
  }
}
</style>

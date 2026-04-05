<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="420px"
    :close-on-click-modal="false"
    :close-on-press-escape="!mandatory"
    :show-close="!mandatory"
    destroy-on-close
  >
    <el-alert
      v-if="mandatory"
      type="warning"
      :closable="false"
      show-icon
      class="mb-4"
      title="请输入班级邀请码"
      description="当前账号还没有加入任何班级。加入班级前，学生端功能将被限制使用。"
    />

    <el-form ref="formRef" :model="formData" :rules="formRules" label-width="80px">
      <el-form-item label="班级码" prop="code">
        <el-input
          v-model="formData.code"
          placeholder="请输入班级邀请码"
          clearable
          class="w-full"
          @keyup.enter="handleSubmit"
        />
        <div class="text-xs text-gray-500 mt-1">请向您的老师获取班级邀请码</div>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="flex justify-end gap-3 flex-wrap">
        <el-button v-if="mandatory" @click="handleLogoutToHome">
          退出登录并回主页
        </el-button>
        <el-button v-else @click="handleCancel">取消</el-button>
        <el-button type="primary" :loading="loading" @click="handleSubmit">
          {{ mandatory ? "立即加入班级" : "加入班级" }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { computed, defineComponent, reactive, ref, watch } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import { joinClass } from "../api/classes";
import type { JoinClassParams } from "../types/classes";

export default defineComponent({
  name: "JoinClassDialog",
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    mandatory: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["update:modelValue", "success"],
  setup(props, { emit }) {
    const store = useStore();
    const router = useRouter();
    const formRef = ref<FormInstance>();
    const loading = ref(false);

    const dialogVisible = computed({
      get: () => props.modelValue,
      set: (value: boolean) => emit("update:modelValue", value),
    });

    const dialogTitle = computed(() =>
      props.mandatory ? "班级邀请码必填" : "加入班级"
    );

    const formData = reactive<JoinClassParams>({
      code: "",
    });

    const formRules: FormRules = {
      code: [
        { required: true, message: "请输入班级邀请码", trigger: "blur" },
        { min: 4, max: 10, message: "班级邀请码长度为 4-10 位", trigger: "blur" },
        {
          pattern: /^[A-Za-z0-9]+$/,
          message: "班级邀请码只能包含字母和数字",
          trigger: "blur",
        },
      ],
    };

    const resetForm = () => {
      formData.code = "";
      formRef.value?.clearValidate();
    };

    watch(dialogVisible, (visible) => {
      if (!visible) {
        resetForm();
      }
    });

    const handleCancel = () => {
      if (props.mandatory) return;
      dialogVisible.value = false;
    };

    const handleLogoutToHome = async () => {
      loading.value = true;
      try {
        await store.dispatch("user/logout", "/home");
        await router.replace("/home");
      } finally {
        loading.value = false;
      }
    };

    const handleSubmit = async () => {
      if (!formRef.value) return;

      try {
        await formRef.value.validate();
        loading.value = true;

        await joinClass(formData);
        ElMessage.success("成功加入班级");
        dialogVisible.value = false;
        emit("success");
      } catch (error) {
        console.error("加入班级失败:", error);
      } finally {
        loading.value = false;
      }
    };

    return {
      dialogVisible,
      dialogTitle,
      formRef,
      formData,
      formRules,
      loading,
      mandatory: props.mandatory,
      handleCancel,
      handleLogoutToHome,
      handleSubmit,
    };
  },
});
</script>

<style scoped>
:deep(.el-dialog__body) {
  padding: 20px 24px;
}
</style>

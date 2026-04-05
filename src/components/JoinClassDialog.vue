<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="400px"
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

    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="80px"
    >
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
      <div class="flex justify-end space-x-3">
        <el-button v-if="!mandatory" @click="handleCancel"> 取消 </el-button>
        <el-button type="primary" :loading="loading" @click="handleSubmit">
          {{ mandatory ? "立即加入班级" : "加入班级" }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { ref, reactive, computed, watch, defineComponent } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
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
    // 表单引用
    const formRef = ref<FormInstance>();

    // 加载状态
    const loading = ref(false);

    // 对话框显示状态
    const dialogVisible = computed({
      get: () => props.modelValue,
      set: (value) => emit("update:modelValue", value),
    });

    const dialogTitle = computed(() =>
      props.mandatory ? "班级邀请码必填" : "加入班级"
    );

    // 表单数据
    const formData = reactive<JoinClassParams>({
      code: "",
    });

    // 表单验证规则
    const formRules: FormRules = {
      code: [
        { required: true, message: "请输入班级邀请码", trigger: "blur" },
        { min: 4, max: 10, message: "班级邀请码长度为4-10位", trigger: "blur" },
        {
          pattern: /^[A-Za-z0-9]+$/,
          message: "班级邀请码只能包含字母和数字",
          trigger: "blur",
        },
      ],
    };

    // 重置表单
    const resetForm = () => {
      formData.code = "";
      formRef.value?.clearValidate();
    };

    // 监听对话框关闭，重置表单
    watch(dialogVisible, (newVal) => {
      if (!newVal) {
        resetForm();
      }
    });

    // 处理取消
    const handleCancel = () => {
      if (props.mandatory) return;
      dialogVisible.value = false;
    };

    // 处理提交
    const handleSubmit = async () => {
      if (!formRef.value) return;

      try {
        await formRef.value.validate();
        loading.value = true;

        await joinClass(formData);
        ElMessage.success("成功加入班级");
        dialogVisible.value = false;
        emit("success");
      } catch (error: any) {
        console.error("加入班级失败:", error);
        // 错误提示已在统一请求层处理，此处不重复弹出
      } finally {
        loading.value = false;
      }
    };

    return {
      formRef,
      loading,
      dialogVisible,
      dialogTitle,
      formData,
      formRules,
      mandatory: props.mandatory,
      resetForm,
      handleCancel,
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

import { createApp } from "vue";
import { ElLoading } from "element-plus";
import "element-plus/dist/index.css";
import App from "./App.vue";
import router from "./router";
import store from "@/store";
import "./router/permission";
import "@wangeditor/editor/dist/css/style.css";
import "@/assets/wangEidtAdd.css";
import "@/assets/styles/adaptive-table.css";
import moment from "moment";
import "moment/locale/zh-cn";

moment.locale("zh-cn");

const app = createApp(App);

app.config.errorHandler = (err, vm, info) => {
  console.error("Vue global error:", err, info);
  if (import.meta.env.DEV) {
    console.error("Error detail:", err);
  }
};

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});

app.use(store);
app.use(router);
app.directive("loading", ElLoading.directive);

app.mount("#app");

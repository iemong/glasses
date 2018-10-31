import Vue from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";

Vue.config.productionTip = false;


if(location.protocol == 'http:') {
    location.replace(location.href.replace(/http:/, 'https:'));
}

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount("#app");
